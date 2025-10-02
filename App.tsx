import React, { useState, useCallback, useEffect } from 'react';
import { editImage as geminiEditImage } from './services/geminiService.js';
import { TRANSFORMATIONS } from './constants';
import type { GeneratedContent, Transformation, User } from './types';
import TransformationSelector from './components/TransformationSelector';
import ResultDisplay from './components/ResultDisplay';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import ImageEditorCanvas from './components/ImageEditorCanvas';
import { dataUrlToFile, embedWatermark, loadImage, resizeImageToMatch, downloadImage } from './utils/fileUtils';
import ImagePreviewModal from './components/ImagePreviewModal';
import MultiImageUploader from './components/MultiImageUploader';
import HistoryPanel from './components/HistoryPanel';
import { useTranslation } from './i18n/context';
import LanguageSwitcher from './components/LanguageSwitcher';
import ThemeSwitcher from './components/ThemeSwitcher';
import { useAuth } from './auth/authContext';
import LoginModal from './auth/LoginModal';
import RegisterModal from './auth/RegisterModal';
import UserProfile from './auth/UserProfile';

type ActiveTool = 'mask' | 'none';

const App: React.FC = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated, getBalance } = useAuth();
  
  // 用于强制重新渲染组件，确保AuthContext的状态更新能被正确捕获
  const [forceUpdate, setForceUpdate] = useState(false);
  
  const [transformations, setTransformations] = useState<Transformation[]>(() => {
    try {
      const savedOrder = localStorage.getItem('transformationOrder');
      if (savedOrder) {
        const orderedKeys = JSON.parse(savedOrder) as string[];
        const transformationMap = new Map(TRANSFORMATIONS.map(t => [t.key, t]));
        
        const orderedTransformations = orderedKeys
          .map(key => transformationMap.get(key))
          .filter((t): t is Transformation => !!t);

        const savedKeysSet = new Set(orderedKeys);
        const newTransformations = TRANSFORMATIONS.filter(t => !savedKeysSet.has(t.key));
        
        return [...orderedTransformations, ...newTransformations];
      }
    } catch (e) {
      console.error("Failed to load or parse transformation order from localStorage", e);
    }
    return TRANSFORMATIONS;
  });

  const [selectedTransformation, setSelectedTransformation] = useState<Transformation | null>(null);
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(null);
  const [primaryFile, setPrimaryFile] = useState<File | null>(null);
  const [secondaryImageUrl, setSecondaryImageUrl] = useState<string | null>(null);
  const [secondaryFile, setSecondaryFile] = useState<File | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [activeTool, setActiveTool] = useState<ActiveTool>('none');
  const [history, setHistory] = useState<GeneratedContent[]>([]);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<Transformation | null>(null);
  
  // Auth modal states
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [hasPendingGenerationRequest, setHasPendingGenerationRequest] = useState<boolean>(false);
  const [pendingGenerationType, setPendingGenerationType] = useState<'image' | 'video' | null>(null);

  useEffect(() => {
    try {
      const orderToSave = transformations.map(t => t.key);
      localStorage.setItem('transformationOrder', JSON.stringify(orderToSave));
    } catch (e) {
      console.error("Failed to save transformation order to localStorage", e);
    }
  }, [transformations]);

  // Cleanup blob URLs on unmount or when dependencies change
  useEffect(() => {
    return () => {
        history.forEach(item => {
            if (item.videoUrl) {
                URL.revokeObjectURL(item.videoUrl);
            }
        });
        if (generatedContent?.videoUrl) {
            URL.revokeObjectURL(generatedContent.videoUrl);
        }
    };
  }, [history, generatedContent]);




  const handleSelectTransformation = (transformation: Transformation) => {
    setSelectedTransformation(transformation);
    setGeneratedContent(null);
    setError(null);
    if (transformation.prompt !== 'CUSTOM') {
      setCustomPrompt('');
    }
  };

  const handlePrimaryImageSelect = useCallback((file: File, dataUrl: string) => {
    setPrimaryFile(file);
    setPrimaryImageUrl(dataUrl);
    setGeneratedContent(null);
    setError(null);
    setMaskDataUrl(null);
    setActiveTool('none');
  }, []);

  const handleSecondaryImageSelect = useCallback((file: File, dataUrl: string) => {
    setSecondaryFile(file);
    setSecondaryImageUrl(dataUrl);
    setGeneratedContent(null);
    setError(null);
  }, []);
  
  const handleClearPrimaryImage = () => {
    setPrimaryImageUrl(null);
    setPrimaryFile(null);
    setGeneratedContent(null);
    setError(null);
    setMaskDataUrl(null);
    setActiveTool('none');
  };
  
  const handleClearSecondaryImage = () => {
    setSecondaryImageUrl(null);
    setSecondaryFile(null);
  };

  const handleGenerateVideo = useCallback(async () => {
    if (!selectedTransformation) return;

    const promptToUse = customPrompt;
    if (!promptToUse.trim()) {
        setError(t('app.error.enterPrompt'));
        return;
    }

    // Check if user is authenticated
    if (!isAuthenticated) {
      setIsLoginModalOpen(true);
      setHasPendingGenerationRequest(true);
      setPendingGenerationType('video');
      return;
    }

    // Check if user has enough credits (at least 3)
    const balance = await getBalance();
    if (balance < 3) {
      setError(t('auth.insufficientCredits'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedContent(null);

    try {
        let imagePayload = null;
        if (primaryImageUrl) {
            const primaryMimeType = primaryImageUrl.split(';')[0].split(':')[1] ?? 'image/png';
            const primaryBase64 = primaryImageUrl.split(',')[1];
            imagePayload = { base64: primaryBase64, mimeType: primaryMimeType };
        }

        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3000/api/services/generate-video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                prompt: promptToUse,
                aspectRatio: aspectRatio,
                image: imagePayload
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                throw new Error('401');
            } else if (response.status === 402) {
                throw new Error('402');
            }
            throw new Error(`Failed to generate video. Status: ${response.statusText}`);
        }

        const data = await response.json();
        const videoUrl = data.videoUrl;
        
        setLoadingMessage(t('app.loading.videoFetching'));
        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download video file. Status: ${videoResponse.statusText}`);
        }
        const blob = await videoResponse.blob();
        const objectUrl = URL.createObjectURL(blob);

        const result: GeneratedContent = {
            imageUrl: null,
            text: null,
            videoUrl: objectUrl
        };

        setGeneratedContent(result);
        setHistory(prev => [result, ...prev]);

    } catch (err) {
        console.error(err);
        if (err instanceof Error && err.message === '401') {
          // Token expired or invalid
          localStorage.removeItem('token');
          setError(t('auth.tokenExpired'));
          setIsLoginModalOpen(true);
        } else if (err instanceof Error && err.message === '402') {
          // Insufficient credits
          setError(t('auth.insufficientCredits'));
        } else {
          setError(err instanceof Error ? err.message : t('app.error.unknown'));
        }
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [selectedTransformation, customPrompt, primaryImageUrl, aspectRatio, t, isAuthenticated, setIsLoginModalOpen, getBalance]);

  const handleGenerateImage = useCallback(async () => {
    if (!primaryImageUrl || !selectedTransformation) {
        setError(t('app.error.uploadAndSelect'));
        return;
    }
    if (selectedTransformation.isMultiImage && !selectedTransformation.isSecondaryOptional && !secondaryImageUrl) {
        setError(t('app.error.uploadBoth'));
        return;
    }
    
    const promptToUse = selectedTransformation.prompt === 'CUSTOM' ? customPrompt : selectedTransformation.prompt;
    if (!promptToUse.trim()) {
        setError(t('app.error.enterPrompt'));
        return;
    }

    // Check if user is authenticated
    if (!isAuthenticated) {
      setIsLoginModalOpen(true);
      setHasPendingGenerationRequest(true);
      setPendingGenerationType('image');
      return;
    }

    // Check if user has enough credits (at least 3)
    const balance = await getBalance();
    if (balance < 3) {
      setError(t('auth.insufficientCredits'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedContent(null);
    setLoadingMessage('');

    try {
        const primaryMimeType = primaryImageUrl!.split(';')[0].split(':')[1] ?? 'image/png';
        const primaryBase64 = primaryImageUrl!.split(',')[1];
        const maskBase64 = maskDataUrl ? maskDataUrl.split(',')[1] : null;

        let secondaryImagePayload = null;
        if (selectedTransformation.isMultiImage && secondaryImageUrl) {
            const secondaryMimeType = secondaryImageUrl.split(';')[0].split(':')[1] ?? 'image/png';
            const secondaryBase64 = secondaryImageUrl.split(',')[1];
            secondaryImagePayload = { base64: secondaryBase64, mimeType: secondaryMimeType };
        }
        
        // 对于两步转换，我们需要使用不同的处理方式
        const isTwoStep = selectedTransformation.isTwoStep || false;
        const stepTwoPrompt = selectedTransformation.stepTwoPrompt || '';
        
        setLoadingMessage(selectedTransformation.isTwoStep ? t('app.loading.step1') : t('app.loading.default'));
        
        // 通过服务器API调用，以确保credit被正确扣减
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3000/api/services/edit-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                base64ImageData: primaryBase64,
                mimeType: primaryMimeType,
                prompt: promptToUse,
                maskBase64: maskBase64,
                secondaryImage: secondaryImagePayload,
                isTwoStep: isTwoStep,
                stepTwoPrompt: stepTwoPrompt
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                throw new Error('401');
            } else if (response.status === 402) {
                throw new Error('402');
            }
            throw new Error(`Failed to generate image. Status: ${response.statusText}`);
        }

        const data = await response.json();
        let result = data.result;

        // Apply watermark if needed
        if (result.imageUrl) {
            result.imageUrl = await embedWatermark(result.imageUrl, "Nano Bananary｜ZHO");
        }

        // Update state with the generated result
        setGeneratedContent(result);
        setHistory(prev => [result, ...prev]);
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.message === '401') {
        // Token expired or invalid
        localStorage.removeItem('token');
        setError(t('auth.tokenExpired'));
        setIsLoginModalOpen(true);
      } else if (err instanceof Error && err.message === '402') {
        // Insufficient credits
        setError(t('auth.insufficientCredits'));
      } else {
        setError(err instanceof Error ? err.message : t('app.error.unknown'));
      }
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [primaryImageUrl, secondaryImageUrl, selectedTransformation, maskDataUrl, customPrompt, t, isAuthenticated, setIsLoginModalOpen, getBalance, embedWatermark]);
  
  // When user logs in and there's a pending generation request, execute it
  useEffect(() => {
    if (isAuthenticated && hasPendingGenerationRequest) {
      setHasPendingGenerationRequest(false);
      if (pendingGenerationType === 'video') {
        handleGenerateVideo();
      } else {
        handleGenerateImage();
      }
      setPendingGenerationType(null);
    }
  }, [isAuthenticated, hasPendingGenerationRequest, pendingGenerationType, handleGenerateImage, handleGenerateVideo]);

  const handleGenerate = useCallback(() => {
    if (selectedTransformation?.isVideo) {
      handleGenerateVideo();
    } else {
      handleGenerateImage();
    }
  }, [selectedTransformation, handleGenerateVideo, handleGenerateImage]);


  const handleUseImageAsInput = useCallback(async (imageUrl: string) => {
    if (!imageUrl) return;

    try {
      const newFile = await dataUrlToFile(imageUrl, `edited-${Date.now()}.png`);
      setPrimaryFile(newFile);
      setPrimaryImageUrl(imageUrl);
      setGeneratedContent(null);
      setError(null);
      setMaskDataUrl(null);
      setActiveTool('none');
      setSecondaryFile(null);
      setSecondaryImageUrl(null);
      setSelectedTransformation(null); 
      setActiveCategory(null);
    } catch (err) {
      console.error("Failed to use image as input:", err);
      setError(t('app.error.useAsInputFailed'));
    }
  }, [t]);
  
  const toggleHistoryPanel = () => setIsHistoryPanelOpen(prev => !prev);
  
  const handleUseHistoryImageAsInput = (imageUrl: string) => {
      handleUseImageAsInput(imageUrl);
      setIsHistoryPanelOpen(false);
  };
  
  const handleDownloadFromHistory = (url: string, type: string) => {
      const fileExtension = type.includes('video') ? 'mp4' : (url.split(';')[0].split('/')[1] || 'png');
      const filename = `${type}-${Date.now()}.${fileExtension}`;
      downloadImage(url, filename);
  };

  const handleBackToSelection = () => {
    setSelectedTransformation(null);
  };

  const handleResetApp = () => {
    setSelectedTransformation(null);
    setPrimaryImageUrl(null);
    setPrimaryFile(null);
    setSecondaryImageUrl(null);
    setSecondaryFile(null);
    setGeneratedContent(null);
    setError(null);
    setIsLoading(false);
    setMaskDataUrl(null);
    setCustomPrompt('');
    setActiveTool('none');
    setActiveCategory(null);
  };

  const handleOpenPreview = (url: string) => setPreviewImageUrl(url);
  const handleClosePreview = () => setPreviewImageUrl(null);
  
  const toggleMaskTool = () => {
    setActiveTool(current => (current === 'mask' ? 'none' : 'mask'));
  };
  
  const isCustomPromptEmpty = selectedTransformation?.prompt === 'CUSTOM' && !customPrompt.trim();
  
  let isGenerateDisabled = true;
  if (selectedTransformation) {
    if (selectedTransformation.isVideo) {
        isGenerateDisabled = isLoading || !customPrompt.trim();
    } else {
        let imagesReady = false;
        if (selectedTransformation.isMultiImage) {
            if (selectedTransformation.isSecondaryOptional) {
                imagesReady = !!primaryImageUrl;
            } else {
                imagesReady = !!primaryImageUrl && !!secondaryImageUrl;
            }
        } else {
            imagesReady = !!primaryImageUrl;
        }
        isGenerateDisabled = isLoading || isCustomPromptEmpty || !imagesReady;
    }
  }

  const renderInputUI = () => {
    if (!selectedTransformation) return null;

    if (selectedTransformation.isVideo) {
      return (
        <>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={t('transformations.video.promptPlaceholder')}
            rows={4}
            className="w-full mt-2 p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] transition-colors placeholder-[var(--text-tertiary)]"
          />
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{t('transformations.video.aspectRatio')}</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['16:9', '9:16'] as const).map(ratio => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`py-2 px-3 text-sm font-semibold rounded-md transition-colors duration-200 ${
                    aspectRatio === ratio ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-on-accent)]' : 'bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)]'
                  }`}
                >
                  {t(ratio === '16:9' ? 'transformations.video.landscape' : 'transformations.video.portrait')}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
             <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{t('transformations.effects.customPrompt.uploader2Title')}</h3>
            <ImageEditorCanvas
                onImageSelect={handlePrimaryImageSelect}
                initialImageUrl={primaryImageUrl}
                onMaskChange={() => {}}
                onClearImage={handleClearPrimaryImage}
                isMaskToolActive={false}
            />
          </div>
        </>
      );
    }

    if (selectedTransformation.isMultiImage) {
      return (
        <MultiImageUploader
          onPrimarySelect={handlePrimaryImageSelect}
          onSecondarySelect={handleSecondaryImageSelect}
          primaryImageUrl={primaryImageUrl}
          secondaryImageUrl={secondaryImageUrl}
          onClearPrimary={handleClearPrimaryImage}
          onClearSecondary={handleClearSecondaryImage}
          primaryTitle={selectedTransformation.primaryUploaderTitle ? t(selectedTransformation.primaryUploaderTitle) : undefined}
          primaryDescription={selectedTransformation.primaryUploaderDescription ? t(selectedTransformation.primaryUploaderDescription) : undefined}
          secondaryTitle={selectedTransformation.secondaryUploaderTitle ? t(selectedTransformation.secondaryUploaderTitle) : undefined}
          secondaryDescription={selectedTransformation.secondaryUploaderDescription ? t(selectedTransformation.secondaryUploaderDescription) : undefined}
        />
      );
    }

    return (
      <>
        <ImageEditorCanvas
          onImageSelect={handlePrimaryImageSelect}
          initialImageUrl={primaryImageUrl}
          onMaskChange={setMaskDataUrl}
          onClearImage={handleClearPrimaryImage}
          isMaskToolActive={activeTool === 'mask'}
        />
        {primaryImageUrl && (
          <div className="mt-4">
            <button
              onClick={toggleMaskTool}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold rounded-md transition-colors duration-200 ${
                activeTool === 'mask' ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-on-accent)]' : 'bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)]'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
              <span>{t('imageEditor.drawMask')}</span>
            </button>
          </div>
        )}
      </>
    );
  };


  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans" key={forceUpdate}>
      <header className="bg-[var(--bg-card-alpha)] backdrop-blur-lg sticky top-0 z-20 p-4 border-b border-[var(--border-primary)]">
        <div className="container mx-auto flex justify-between items-center">
          <h1 
            className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] cursor-pointer" 
            onClick={handleResetApp}
          >
            {t('app.title')}
          </h1>
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={toggleHistoryPanel}
              className="flex items-center gap-2 py-2 px-3 text-sm font-semibold text-[var(--text-primary)] bg-[rgba(107,114,128,0.2)] rounded-md hover:bg-[rgba(107,114,128,0.4)] transition-colors duration-200"
              aria-label="Toggle generation history"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span className="hidden sm:inline">{t('app.history')}</span>
            </button>
            
            {/* Auth buttons */}
            {!isAuthenticated ? (
              <>
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="py-2 px-3 text-sm font-semibold text-[var(--text-primary)] bg-[rgba(107,114,128,0.2)] rounded-md hover:bg-[rgba(107,114,128,0.4)] transition-colors duration-200"
                >
                  {t('auth.login')}
                </button>
                <button
                  onClick={() => setIsRegisterModalOpen(true)}
                  className="py-2 px-3 text-sm font-semibold text-[var(--text-on-accent)] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] rounded-md hover:from-[var(--accent-primary-hover)] hover:to-[var(--accent-secondary-hover)] transition-colors duration-200"
                >
                  {t('auth.register')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center gap-2 py-2 px-3 text-sm font-semibold text-[var(--text-primary)] rounded-full hover:bg-[rgba(107,114,128,0.2)] transition-colors duration-200"
                  aria-label="User profile"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-white text-xs font-bold">
                    {user?.username.charAt(0).toUpperCase()}
                  </div>
                </button>
              </>
            )}
            
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main>
        {!selectedTransformation ? (
          <TransformationSelector 
            transformations={transformations} 
            onSelect={handleSelectTransformation} 
            hasPreviousResult={!!primaryImageUrl}
            onOrderChange={setTransformations}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
          />
        ) : (
          <div className="container mx-auto p-4 md:p-8 animate-fade-in">
            <div className="mb-8">
              <button
                onClick={handleBackToSelection}
                className="flex items-center gap-2 text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] transition-colors duration-200 py-2 px-4 rounded-lg hover:bg-[rgba(107,114,128,0.1)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {t('app.chooseAnotherEffect')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Input Column */}
              <div className="flex flex-col gap-6 p-6 bg-[var(--bg-card-alpha)] backdrop-blur-lg rounded-xl border border-[var(--border-primary)] shadow-2xl shadow-black/20">
                <div>
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold mb-1 text-[var(--accent-primary)] flex items-center gap-3">
                      <span className="text-3xl">{selectedTransformation.emoji}</span>
                      {t(selectedTransformation.titleKey)}
                    </h2>
                    {selectedTransformation.prompt !== 'CUSTOM' ? (
                       <p className="text-[var(--text-secondary)]">{t(selectedTransformation.descriptionKey)}</p>
                    ) : (
                      !selectedTransformation.isVideo && <p className="text-[var(--text-secondary)]">{t(selectedTransformation.descriptionKey)}</p>
                    )}
                  </div>
                  
                  {selectedTransformation.prompt === 'CUSTOM' && !selectedTransformation.isVideo && (
                    <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="e.g., 'make the sky a vibrant sunset' or 'add a small red boat on the water'"
                        rows={3}
                        className="w-full -mt-2 mb-4 p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] transition-colors placeholder-[var(--text-tertiary)]"
                    />
                  )}
                  
                  {renderInputUI()}
                  
                   <button
                    onClick={handleGenerate}
                    disabled={isGenerateDisabled}
                    className="w-full mt-6 py-3 px-4 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold rounded-lg shadow-lg shadow-[var(--accent-shadow)] hover:from-[var(--accent-primary-hover)] hover:to-[var(--accent-secondary-hover)] disabled:bg-[var(--bg-disabled)] disabled:from-[var(--bg-disabled)] disabled:to-[var(--bg-disabled)] disabled:text-[var(--text-disabled)] disabled:shadow-none disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{t('app.generating')}</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span>{t('app.generateImage')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Output Column */}
              <div className="flex flex-col p-6 bg-[var(--bg-card-alpha)] backdrop-blur-lg rounded-xl border border-[var(--border-primary)] shadow-2xl shadow-black/20">
                <h2 className="text-xl font-semibold mb-4 text-[var(--accent-primary)] self-start">{t('app.result')}</h2>
                {isLoading && <div className="flex-grow flex items-center justify-center"><LoadingSpinner message={loadingMessage} /></div>}
                {error && <div className="flex-grow flex items-center justify-center w-full"><ErrorMessage message={error} /></div>}
                {!isLoading && !error && generatedContent && (
                    <ResultDisplay 
                        content={generatedContent} 
                        onUseImageAsInput={handleUseImageAsInput}
                        onImageClick={handleOpenPreview}
                        originalImageUrl={primaryImageUrl}
                    />
                )}
                {!isLoading && !error && !generatedContent && (
                  <div className="flex-grow flex flex-col items-center justify-center text-center text-[var(--text-tertiary)]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-2">{t('app.yourImageWillAppear')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      <ImagePreviewModal imageUrl={previewImageUrl} onClose={handleClosePreview} />
      <HistoryPanel
        isOpen={isHistoryPanelOpen}
        onClose={toggleHistoryPanel}
        history={history}
        onUseImage={handleUseHistoryImageAsInput}
        onDownload={handleDownloadFromHistory}
      />
      
      {/* Auth modals */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onRegisterClick={() => {
          setIsLoginModalOpen(false);
          setIsRegisterModalOpen(true);
        }}
        onLoginSuccess={() => {
          // 强制重新渲染组件以更新用户状态
          setForceUpdate(prev => !prev);
        }}
      />
      
      <RegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onLoginClick={() => {
          setIsRegisterModalOpen(false);
          setIsLoginModalOpen(true);
        }}
        onRegisterSuccess={() => {
          // 强制重新渲染组件以更新用户状态
          setForceUpdate(prev => !prev);
        }}
      />
      
      <UserProfile
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

// Add fade-in animation for view transitions
const style = document.createElement('style');
style.innerHTML = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 0.4s ease-out forwards;
  }
  @keyframes fadeInFast {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .animate-fade-in-fast {
    animation: fadeInFast 0.2s ease-out forwards;
  }
`;
document.head.appendChild(style);


export default App;
