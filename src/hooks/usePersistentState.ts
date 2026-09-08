import { useState, useEffect, Dispatch, SetStateAction } from 'react';

type Deserializer<T> = (value: string) => T;

export function usePersistentState<T>(
  key: string,
  initialValue: T,
  deserializer?: Deserializer<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const storedValue = localStorage.getItem(key);
      if (storedValue !== null) {
        return deserializer ? deserializer(storedValue) : JSON.parse(storedValue);
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
    }
    return initialValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error writing localStorage key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState];
}
