import { useEffect, useState, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { API } from '@/lib/api';
import RequestCard from '@/components/admin/RequestCard';
import GroupsTab from '@/components/admin/GroupsTab';
import ScheduleInfo from '@/components/admin/ScheduleInfo';
import { AdRequest, CityGroup } from '@/components/admin/types';

const FILTERS = [
  { key: 'new', label: 'Новые' },
  { key: 'edits', label: 'Требуют решения' },
  { key: 'running', label: 'Крутятся' },
  { key: 'stopped', label: 'Остановлены' },
  { key: 'all', label: 'Все' },
];

const Admin = () => {
  const [password, setPassword] = useState(() => localStorage.getItem('admin_pw') || '');
  const [input, setInput] = useState('');
  const [authed, setAuthed] = useState(false);
  const [requests, setRequests] = useState<AdRequest[]>([]);
  const [groups, setGroups] = useState<CityGroup[]>([]);
  const [heartbeat, setHeartbeat] = useState<{ last_run_at: string | null; minutes_ago: number | null } | null>(null);
  const [tab, setTab] = useState<'requests' | 'groups' | 'schedule'>('requests');
  const [filter, setFilter] = useState('new');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (pw: string, silent = false) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const res = await fetch(API.adminRequests, { headers: { 'X-Admin-Password': pw } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
        setRequests(data.requests || []);
        setGroups(data.groups || []);
        setHeartbeat(data.heartbeat || null);
        setAuthed(true);
        localStorage.setItem('admin_pw', pw);
      } catch (err) {
        setAuthed(false);
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (password) load(password);
  }, []);

  useEffect(() => {
    if (!authed || !password) return;
    const id = window.setInterval(() => load(password, true), 60000);
    return () => window.clearInterval(id);
  }, [authed, password, load]);

  const act = async (body: Record<string, unknown>) => {
    if (body.action === 'refresh') {
      await load(password, true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(API.adminRequests, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось выполнить');
      await load(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить');
    } finally {
      setBusy(false);
    }
  };

  const runPublisher = async () => {
    setBusy(true);
    try {
      await fetch(API.publishRunner, { method: 'POST', body: '{}' });
      await load(password);
    } catch {
      setError('Не удалось запустить публикатор');
    } finally {
      setBusy(false);
    }
  };

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="card w-full max-w-sm">
          <Icon name="Lock" size={30} style={{ color: 'var(--hero-accent)' }} />
          <h1 className="mt-5 text-2xl uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
            Панель модератора
          </h1>
          <form
            className="mt-6 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setPassword(input);
              load(input);
            }}
          >
            <input
              className="field"
              type="password"
              placeholder="Пароль"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            {error && (
              <span className="text-sm" style={{ color: 'var(--hero-accent)' }}>
                {error}
              </span>
            )}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Проверяем...' : 'Войти'}
            </button>
          </form>
          <a
            href="/"
            className="mt-5 block text-sm"
            style={{ color: 'var(--hero-muted)' }}
          >
            ← На сайт
          </a>
        </div>
      </div>
    );
  }

  const visible = requests.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'new') return r.status === 'new' && !r.campaign;
    if (filter === 'edits') return Boolean(r.pending || r.renew);
    if (filter === 'running') return r.campaign?.state === 'running';
    if (filter === 'stopped')
      return r.campaign && ['stopped', 'expired'].includes(r.campaign.state);
    return true;
  });

  const stats = {
    newCount: requests.filter((r) => r.status === 'new' && !r.campaign).length,
    edits: requests.filter((r) => r.pending || r.renew).length,
    running: requests.filter((r) => r.campaign?.state === 'running').length,
    posts: requests.reduce((sum, r) => sum + (r.campaign?.posts_sent || 0), 0),
    revenue: requests.reduce((sum, r) => sum + (r.total_paid || 0), 0),
  };

  return (
    <div className="min-h-screen">
      <header style={{ borderBottom: '1px solid var(--hero-x-rule)' }}>
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <Icon name="LayoutDashboard" size={22} style={{ color: 'var(--hero-accent)' }} />
            <span
              className="text-lg uppercase"
              style={{ fontFamily: 'var(--hero-font-head)', letterSpacing: '0.08em' }}
            >
              Панель модератора
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="btn btn-ghost"
              disabled={busy}
              style={{ padding: '10px 18px', fontSize: '0.72em' }}
              onClick={runPublisher}
            >
              <Icon name="Play" size={14} />
              Прогнать публикатор
            </button>
            <button
              className="btn btn-ghost"
              disabled={loading}
              style={{ padding: '10px 18px', fontSize: '0.72em' }}
              onClick={() => load(password)}
            >
              <Icon name="RefreshCw" size={14} />
              Обновить
            </button>
            <a className="btn btn-ghost" href="/" style={{ padding: '10px 18px', fontSize: '0.72em' }}>
              На сайт
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-10">
        {heartbeat && heartbeat.minutes_ago !== null && heartbeat.minutes_ago <= 20 && (
          <div className="mb-6 flex items-center gap-3 text-sm" style={{ color: 'var(--hero-muted)' }}>
            <Icon name="CircleCheck" size={16} style={{ color: 'var(--hero-x-quarter)' }} />
            <span>
              Автопубликация работает. Последняя проверка{' '}
              {heartbeat.minutes_ago < 1.5 ? 'меньше минуты назад' : `${Math.round(heartbeat.minutes_ago)} мин назад`}.
            </span>
          </div>
        )}

        {heartbeat && heartbeat.minutes_ago !== null && heartbeat.minutes_ago > 20 && (
          <div
            className="mb-6 flex flex-wrap items-center gap-4 p-4"
            style={{ background: 'var(--hero-surface)', border: '1px solid var(--hero-accent)' }}
          >
            <Icon name="TriangleAlert" size={22} style={{ color: 'var(--hero-accent)' }} />
            <div className="flex-1" style={{ minWidth: 240 }}>
              <div style={{ fontFamily: 'var(--hero-font-head)', textTransform: 'uppercase' }}>
                Публикация не запускалась{' '}
                {heartbeat.minutes_ago > 120
                  ? `${Math.round(heartbeat.minutes_ago / 60)} ч`
                  : `${Math.round(heartbeat.minutes_ago)} мин`}
              </div>
              <p className="mt-1 text-sm" style={{ color: 'var(--hero-muted)' }}>
                Объявления могут выходить с задержкой. Подключите планировщик во вкладке
                «Расписание» — это займёт пару минут.
              </p>
            </div>
            <button
              className="btn btn-primary"
              style={{ padding: '10px 20px', fontSize: '0.72em' }}
              onClick={() => setTab('schedule')}
            >
              Настроить
            </button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Новых заявок', value: stats.newCount, icon: 'Inbox' },
            { label: 'Активных откруток', value: stats.running, icon: 'Radio' },
            { label: 'Всего публикаций', value: stats.posts, icon: 'Send' },
            { label: 'Оплачено, ₽', value: stats.revenue, icon: 'Wallet' },
          ].map((s) => (
            <div key={s.label} className="card flex items-center justify-between">
              <div>
                <div className="text-3xl" style={{ fontFamily: 'var(--hero-font-head)' }}>
                  {s.value}
                </div>
                <div className="mt-1 text-sm" style={{ color: 'var(--hero-muted)' }}>
                  {s.label}
                </div>
              </div>
              <Icon name={s.icon} size={26} style={{ color: 'var(--hero-accent)' }} />
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {(['requests', 'groups', 'schedule'] as const).map((t) => (
            <button
              key={t}
              className={t === tab ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ padding: '10px 20px', fontSize: '0.75em' }}
              onClick={() => setTab(t)}
            >
              {t === 'requests' ? 'Заявки' : t === 'groups' ? 'Города и группы' : 'Расписание'}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 flex items-center gap-2" style={{ color: 'var(--hero-accent)' }}>
            <Icon name="TriangleAlert" size={18} />
            <span>{error}</span>
          </div>
        )}

        {tab === 'requests' ? (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  className="chip"
                  style={{
                    cursor: 'pointer',
                    color: filter === f.key ? 'var(--hero-accent)' : 'var(--hero-muted)',
                    borderColor: filter === f.key ? 'var(--hero-accent)' : 'var(--hero-x-rule)',
                  }}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                  {f.key === 'edits' && stats.edits > 0 && ` · ${stats.edits}`}
                </button>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-5">
              {loading && (
                <p style={{ color: 'var(--hero-muted)' }}>Загружаем заявки...</p>
              )}
              {!loading && visible.length === 0 && (
                <div className="card text-center" style={{ color: 'var(--hero-muted)' }}>
                  Здесь пока пусто
                </div>
              )}
              {visible.map((r) => (
                <RequestCard key={r.id} item={r} busy={busy} password={password} onAction={act} />
              ))}
            </div>
          </>
        ) : tab === 'groups' ? (
          <div className="mt-6">
            <GroupsTab groups={groups} busy={busy} onAction={act} />
          </div>
        ) : (
          <div className="mt-6">
            <ScheduleInfo />
          </div>
        )}
      </main>
    </div>
  );
};

export default Admin;