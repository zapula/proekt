import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react';
import type { IAnimal } from '../animals';
import type { RegionCode } from '../regions';
import type { User } from '../types';

interface AppContextValue {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  selectedAnimal: IAnimal | null;
  setSelectedAnimal: Dispatch<SetStateAction<IAnimal | null>>;
  selectedRegion: RegionCode | null;
  setSelectedRegion: Dispatch<SetStateAction<RegionCode | null>>;
  isAdminMode: boolean;
  setIsAdminMode: Dispatch<SetStateAction<boolean>>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<IAnimal | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionCode | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);

  const value = useMemo(
    () => ({
      user,
      setUser,
      selectedAnimal,
      setSelectedAnimal,
      selectedRegion,
      setSelectedRegion,
      isAdminMode,
      setIsAdminMode
    }),
    [isAdminMode, selectedAnimal, selectedRegion, user]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext должен вызываться внутри AppProvider');
  }
  return context;
}
