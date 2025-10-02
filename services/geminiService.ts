
import { GoogleGenAI, Modality } from "@google/genai";
import type { GeneratedContent } from '../types';

// Create a helper function to get a GoogleGenAI client with the provided API key
const getGenAIClient = (apiKey: string) => {
  if (!apiKey) {
    throw new Error("API key is required. Please set GEMINI_API_KEY environment variable or provide it as a parameter.");
  }
  return new GoogleGenAI({ apiKey });
};

export async function editImage(
    base64ImageData: string, 
    mimeType: string, 
    prompt: string,
    maskBase64: string | null,
    secondaryImage: { base64: string; mimeType: string } | null,
    apiKey?: string
): Promise<GeneratedContent> {
  try {
    // 获取 API 密钥（优先使用传入的参数，否则从环境变量获取）
    const keyToUse = apiKey || process.env.GEMINI_API_KEY;
    if (!keyToUse) {
        throw new Error("API key is required. Please set GEMINI_API_KEY environment variable or provide it as a parameter.");
    }
    
    // 使用获取到的 API 密钥创建客户端
    const ai = getGenAIClient(keyToUse);

    let fullPrompt = prompt;
    const parts: any[] = [
      {
        inlineData: {
          data: base64ImageData,
          mimeType: mimeType,
        },
      },
    ];

    if (maskBase64) {
      parts.push({
        inlineData: {
          data: maskBase64,
          mimeType: 'image/png',
        },
      });
      fullPrompt = `Apply the following instruction only to the masked area of the image: "${prompt}". Preserve the unmasked area.`;
    }
    
    if (secondaryImage) {
        parts.push({
            inlineData: {
                data: secondaryImage.base64,
                mimeType: secondaryImage.mimeType,
            },
        });
    }

    parts.push({ text: fullPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const result: GeneratedContent = { imageUrl: null, text: null };
    const responseParts = response.candidates?.[0]?.content?.parts;

    if (responseParts) {
      for (const part of responseParts) {
        if (part.text) {
          result.text = (result.text ? result.text + "\n" : "") + part.text;
        } else if (part.inlineData) {
          result.imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    if (!result.imageUrl) {
        let errorMessage;
        if (result.text) {
            errorMessage = `The model responded: "${result.text}"`;
        } else {
            const finishReason = response.candidates?.[0]?.finishReason;
            const safetyRatings = response.candidates?.[0]?.safetyRatings;
            errorMessage = "The model did not return an image. It might have refused the request. Please try a different image or prompt.";
            
            if (finishReason === 'SAFETY') {
                const blockedCategories = safetyRatings?.filter(r => r.blocked).map(r => r.category).join(', ');
                errorMessage = `The request was blocked for safety reasons. Categories: ${blockedCategories || 'Unknown'}. Please modify your prompt or image.`;
            }
        }
        throw new Error(errorMessage);
    }

    // 注意：积分扣除逻辑已移至服务器端处理

    return result;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        let errorMessage = error.message;
        try {
            const parsedError = JSON.parse(errorMessage);
            if (parsedError.error && parsedError.error.message) {
                if (parsedError.error.status === 'RESOURCE_EXHAUSTED') {
                    errorMessage = "You've likely exceeded the request limit. Please wait a moment before trying again.";
                } else if (parsedError.error.code === 500 || parsedError.error.status === 'UNKNOWN') {
                    errorMessage = "An unexpected server error occurred. This might be a temporary issue. Please try again in a few moments.";
                } else {
                    errorMessage = parsedError.error.message;
                }
            }
        } catch (e) {}
        throw new Error(errorMessage);
    } else {
        throw new Error("An unknown error occurred while communicating with the API.");
    }
  }
}

export async function generateVideo(
    prompt: string,
    image: { base64: string; mimeType: string } | null,
    aspectRatio: '16:9' | '9:16',
    onProgress: (message: string) => void,
    apiKey?: string
): Promise<string> {
    try {
        // 获取 API 密钥（优先使用传入的参数，否则从环境变量获取）
        const keyToUse = apiKey || process.env.GEMINI_API_KEY;
        if (!keyToUse) {
            throw new Error("API key is required. Please set GEMINI_API_KEY environment variable or provide it as a parameter.");
        }
        
        // 使用获取到的 API 密钥创建客户端
        const ai = getGenAIClient(keyToUse);

        onProgress("Initializing video generation...");

        // FIX: The `request` object was explicitly typed as `any`, which caused a loss of type
        // information for the `operation` variable returned by `generateVideos`. This could lead
        // to a TypeScript error. By allowing TypeScript to infer the type, we ensure
        // `operation` is correctly typed, resolving the error.
        const request = {
            model: 'veo-2.0-generate-001',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                aspectRatio: aspectRatio
            },
            ...(image && {
                image: {
                    imageBytes: image.base64,
                    mimeType: image.mimeType
                }
            })
        };

        let operation = await ai.models.generateVideos(request);
        
        onProgress("Polling for results, this may take a few minutes...");

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        if (operation.error) {
            const errorMessage = typeof operation.error === 'object' && operation.error !== null && 'message' in operation.error
                ? String(operation.error.message)
                : "Video generation failed during operation.";
            throw new Error(errorMessage);
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

        if (!downloadLink) {
            throw new Error("Video generation completed, but no download link was found.");
        }

        // 注意：积分扣除逻辑已移至服务器端处理
        // 使用获取到的 API 密钥添加到下载 URL
        return `${downloadLink}&key=${keyToUse}`;

    } catch (error) {
        console.error("Error calling Video Generation API:", error);
        if (error instanceof Error) {
            let errorMessage = error.message;
            try {
                const parsedError = JSON.parse(errorMessage);
                if (parsedError.error && parsedError.error.message) {
                    errorMessage = parsedError.error.message;
                }
            } catch (e) {}
            throw new Error(errorMessage);
        }
        throw new Error("An unknown error occurred during video generation.");
    }
}
