import { useCallback, useReducer, type SetStateAction } from 'react';
import type { NewSpeciesForm } from '../types';

interface SpeciesCreatorState {
  placeLocationCoords: number[] | null;
  selectedSpeciesId: string;
  isSpeciesCreatorOpen: boolean;
  newSpeciesForm: NewSpeciesForm;
  isFolderTouched: boolean;
  speciesFormError: string | null;
  isSpeciesSaving: boolean;
  iconFile: File | null;
  photoFiles: File[];
}

const initialState: SpeciesCreatorState = {
  placeLocationCoords: null,
  selectedSpeciesId: '',
  isSpeciesCreatorOpen: false,
  newSpeciesForm: {
    name: '',
    category: 'mammal',
    diet: 'herbivore',
    isRedBook: false,
    imageFolder: ''
  },
  isFolderTouched: false,
  speciesFormError: null,
  isSpeciesSaving: false,
  iconFile: null,
  photoFiles: []
};

type Action =
  | { type: 'setPlaceLocationCoords'; value: SetStateAction<number[] | null> }
  | { type: 'setSelectedSpeciesId'; value: SetStateAction<string> }
  | { type: 'setIsSpeciesCreatorOpen'; value: SetStateAction<boolean> }
  | { type: 'setNewSpeciesForm'; value: SetStateAction<NewSpeciesForm> }
  | { type: 'setIsFolderTouched'; value: SetStateAction<boolean> }
  | { type: 'setSpeciesFormError'; value: SetStateAction<string | null> }
  | { type: 'setIsSpeciesSaving'; value: SetStateAction<boolean> }
  | { type: 'setIconFile'; value: SetStateAction<File | null> }
  | { type: 'setPhotoFiles'; value: SetStateAction<File[]> }
  | { type: 'resetSpeciesCreatorState' };

const resolveSetStateAction = <T,>(value: SetStateAction<T>, prev: T): T => {
  if (typeof value === 'function') {
    return (value as (prevState: T) => T)(prev);
  }
  return value;
};

const reducer = (state: SpeciesCreatorState, action: Action): SpeciesCreatorState => {
  switch (action.type) {
    case 'setPlaceLocationCoords':
      return { ...state, placeLocationCoords: resolveSetStateAction(action.value, state.placeLocationCoords) };
    case 'setSelectedSpeciesId':
      return { ...state, selectedSpeciesId: resolveSetStateAction(action.value, state.selectedSpeciesId) };
    case 'setIsSpeciesCreatorOpen':
      return { ...state, isSpeciesCreatorOpen: resolveSetStateAction(action.value, state.isSpeciesCreatorOpen) };
    case 'setNewSpeciesForm':
      return { ...state, newSpeciesForm: resolveSetStateAction(action.value, state.newSpeciesForm) };
    case 'setIsFolderTouched':
      return { ...state, isFolderTouched: resolveSetStateAction(action.value, state.isFolderTouched) };
    case 'setSpeciesFormError':
      return { ...state, speciesFormError: resolveSetStateAction(action.value, state.speciesFormError) };
    case 'setIsSpeciesSaving':
      return { ...state, isSpeciesSaving: resolveSetStateAction(action.value, state.isSpeciesSaving) };
    case 'setIconFile':
      return { ...state, iconFile: resolveSetStateAction(action.value, state.iconFile) };
    case 'setPhotoFiles':
      return { ...state, photoFiles: resolveSetStateAction(action.value, state.photoFiles) };
    case 'resetSpeciesCreatorState':
      return { ...initialState };
    default:
      return state;
  }
};

export const useSpeciesCreatorState = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setPlaceLocationCoords = useCallback((value: SetStateAction<number[] | null>) => {
    dispatch({ type: 'setPlaceLocationCoords', value });
  }, []);

  const setSelectedSpeciesId = useCallback((value: SetStateAction<string>) => {
    dispatch({ type: 'setSelectedSpeciesId', value });
  }, []);

  const setIsSpeciesCreatorOpen = useCallback((value: SetStateAction<boolean>) => {
    dispatch({ type: 'setIsSpeciesCreatorOpen', value });
  }, []);

  const setNewSpeciesForm = useCallback((value: SetStateAction<NewSpeciesForm>) => {
    dispatch({ type: 'setNewSpeciesForm', value });
  }, []);

  const setIsFolderTouched = useCallback((value: SetStateAction<boolean>) => {
    dispatch({ type: 'setIsFolderTouched', value });
  }, []);

  const setSpeciesFormError = useCallback((value: SetStateAction<string | null>) => {
    dispatch({ type: 'setSpeciesFormError', value });
  }, []);

  const setIsSpeciesSaving = useCallback((value: SetStateAction<boolean>) => {
    dispatch({ type: 'setIsSpeciesSaving', value });
  }, []);

  const setIconFile = useCallback((value: SetStateAction<File | null>) => {
    dispatch({ type: 'setIconFile', value });
  }, []);

  const setPhotoFiles = useCallback((value: SetStateAction<File[]>) => {
    dispatch({ type: 'setPhotoFiles', value });
  }, []);

  const resetSpeciesCreatorState = useCallback(() => {
    dispatch({ type: 'resetSpeciesCreatorState' });
  }, []);

  return {
    ...state,
    setPlaceLocationCoords,
    setSelectedSpeciesId,
    setIsSpeciesCreatorOpen,
    setNewSpeciesForm,
    setIsFolderTouched,
    setSpeciesFormError,
    setIsSpeciesSaving,
    setIconFile,
    setPhotoFiles,
    resetSpeciesCreatorState
  };
};

export type UseSpeciesCreatorStateResult = ReturnType<typeof useSpeciesCreatorState>;
