import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

interface UseVoiceParams {
  wikiText: string;
  onVoiceAction?: () => void | Promise<void>;
}

const splitTextIntoChunks = (text: string, maxChunkSize = 400) => {
  const chunks: string[] = [];
  let currentChunk = '';
  const sentences = text.split(/(?<=[.!?])\s+/);

  sentences.forEach((sentence) => {
    if (currentChunk.length + sentence.length > maxChunkSize) {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
      return;
    }

    currentChunk = `${currentChunk} ${sentence}`.trim();
  });

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

export const useVoice = ({ wikiText, onVoiceAction }: UseVoiceParams) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSpeakingRef = useRef(false);
  const resetTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  const clearResetTimeout = useCallback(() => {
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, []);

  const stopSpeech = useCallback(() => {
    clearResetTimeout();
    // Полная очистка очереди синтезатора и reset состояния.
    window.speechSynthesis.pause();
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    if (isMountedRef.current) {
      setIsSpeaking(false);
    }
    speechRef.current = null;
  }, [clearResetTimeout]);

  useEffect(() => {
    isMountedRef.current = true;

    const loadVoices = () => {
      if (!isMountedRef.current) return;
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
      if (available.length > 0) {
        setVoiceError(null);
      }
    };

    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();

    return () => {
      isMountedRef.current = false;
      window.speechSynthesis.onvoiceschanged = null;
      stopSpeech();
    };
  }, [stopSpeech]);

  const toggleSpeech = useCallback(async () => {
    if (isSpeaking) {
      stopSpeech();
      return;
    }

    if (!wikiText.trim()) {
      toast('Описание ещё не загружено', { icon: '⚠️' });
      return;
    }

    if (onVoiceAction) {
      await onVoiceAction();
    }

    const availableVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
    if (availableVoices.length === 0) {
      const errorText = 'Голоса не доступны. Проверьте настройки браузера/ОС.';
      setVoiceError(errorText);
      toast.error(errorText);
      return;
    }

    setVoices(availableVoices);
    setVoiceError(null);

    // Полная очистка перед стартом.
    window.speechSynthesis.pause();
    window.speechSynthesis.resume();
    window.speechSynthesis.cancel();

    const chunks = splitTextIntoChunks(wikiText);
    if (chunks.length === 0) {
      return;
    }

    let selectedVoice =
      availableVoices.find((voice) => voice.name.includes('Google русский')) ||
      availableVoices.find((voice) => voice.lang.includes('ru'));

    if (!selectedVoice) {
      selectedVoice = availableVoices[0];
      setVoiceError('Русский голос не найден. Использую голос по умолчанию.');
    }

    let isInterrupted = false;

    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      speechRef.current = utterance;

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.lang = selectedVoice?.lang || 'ru-RU';
      utterance.rate = 0.9;
      utterance.pitch = 1;

      utterance.onstart = () => {
        if (!isMountedRef.current) return;
        if (index === 0) {
          setIsSpeaking(true);
        }
      };

      utterance.onend = () => {
        if (!isMountedRef.current) return;
        if (index === chunks.length - 1 && !isInterrupted) {
          speechRef.current = null;
          setIsSpeaking(false);
        }
      };

      utterance.onerror = (event) => {
        if (!isMountedRef.current) return;
        if (event.error === 'interrupted') {
          isInterrupted = true;
          speechRef.current = null;
          setIsSpeaking(false);
          return;
        }

        speechRef.current = null;
        setIsSpeaking(false);
        setVoiceError(`Ошибка: ${event.error}`);
      };

      window.speechSynthesis.speak(utterance);
    });

    clearResetTimeout();
    resetTimeoutRef.current = window.setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }
      if (!window.speechSynthesis.speaking && isSpeakingRef.current) {
        speechRef.current = null;
        setIsSpeaking(false);
      }
    }, 500);
  }, [clearResetTimeout, isSpeaking, onVoiceAction, stopSpeech, voices, wikiText]);

  return {
    isSpeaking,
    voiceError,
    stopSpeech,
    toggleSpeech
  };
};

export type UseVoiceResult = ReturnType<typeof useVoice>;
