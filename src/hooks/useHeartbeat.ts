import { useEffect } from 'react';
import { API } from '@/lib/api';

const KEY = 'publisher_last_run';
const MIN_GAP_MS = 60 * 1000;

/**
 * Подталкивает публикатор, когда кто-то заходит на сайт.
 * Работает как подстраховка к внешнему планировщику: не чаще раза в минуту
 * и не блокирует загрузку страницы.
 */
const useHeartbeat = () => {
  useEffect(() => {
    const last = Number(localStorage.getItem(KEY) || 0);
    if (Date.now() - last < MIN_GAP_MS) return;

    localStorage.setItem(KEY, String(Date.now()));
    const timer = setTimeout(() => {
      fetch(API.publishRunner, { method: 'POST', body: '{}' }).catch(() => undefined);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);
};

export default useHeartbeat;
