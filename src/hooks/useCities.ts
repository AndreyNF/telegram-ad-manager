import { useEffect, useState } from 'react';
import { API } from '@/lib/api';

export interface City {
  city: string;
  members: string;
  slots: string;
}

const useCities = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(API.clientStatus)
      .then((r) => r.json())
      .then((data) => setCities(data.cities || []))
      .catch(() => setCities([]))
      .finally(() => setLoading(false));
  }, []);

  return { cities, loading };
};

export default useCities;
