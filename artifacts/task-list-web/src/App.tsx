import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCheck, Plus, Sprout, Trash2 } from 'lucide-react';
import {
  getGetTaskSummaryQueryKey,
  getListTasksQueryKey,
  useCreateTask,
  useDeleteTask,
  useGetTaskSummary,
  useListTasks,
  useUpdateTask,
} from '@workspace/api-client-react';
import type { Task } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

function friendlyDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es', { month: 'short', day: 'numeric' }).format(date);
}

function Home() {
  const client = useQueryClient();
  const tasksQuery = useListTasks();
  const summaryQuery = useGetTaskSummary();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [title, setTitle] = useState('');
  const [createError, setCreateError] = useState('');
  const [taskError, setTaskError] = useState('');

  const refreshTaskData = () => {
    void client.invalidateQueries({ queryKey: getListTasksQueryKey() });
    void client.invalidateQueries({ queryKey: getGetTaskSummaryQueryKey() });
  };
  const tasks = tasksQuery.data ?? [];
  const summary = summaryQuery.data;
  const completedRatio = summary && summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
  const pendingTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);
  const busy = createTask.isPending || updateTask.isPending || deleteTask.isPending;

  const submitTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || createTask.isPending) return;
    setCreateError('');
    createTask.mutate(
      { data: { title: cleanTitle } },
      {
        onSuccess: () => {
          setTitle('');
          refreshTaskData();
        },
        onError: () => setCreateError('No se pudo añadir la tarea. Inténtalo de nuevo.'),
      },
    );
  };

  const toggleTask = (task: Task) => {
    setTaskError('');
    updateTask.mutate(
      { taskId: task.id, data: { completed: !task.completed } },
      {
        onSuccess: () => refreshTaskData(),
        onError: () => setTaskError('No se pudo guardar el cambio. Inténtalo de nuevo.'),
      },
    );
  };

  const removeTask = (task: Task) => {
    if (!window.confirm(`¿Eliminar «${task.title}»?`)) return;
    setTaskError('');
    deleteTask.mutate(
      { taskId: task.id },
      {
        onSuccess: () => refreshTaskData(),
        onError: () => setTaskError('No se pudo eliminar la tarea. Inténtalo de nuevo.'),
      },
    );
  };

  const renderTask = (task: Task, index: number) => (
    <li className="task-row" key={task.id} style={{ animationDelay: `${Math.min(index * 45, 300)}ms` }} data-testid={`task-row-${task.id}`}>
      <button
        type="button"
        className={`task-check${task.completed ? ' is-complete' : ''}`}
        aria-label={task.completed ? `Volver a abrir ${task.title}` : `Completar ${task.title}`}
        aria-pressed={task.completed}
        disabled={busy}
        onClick={() => toggleTask(task)}
        data-testid={`button-toggle-task-${task.id}`}
      >
        {task.completed && <Check size={13} strokeWidth={3} aria-hidden="true" />}
      </button>
      <div>
        <div className={`task-title${task.completed ? ' is-complete' : ''}`} data-testid={`text-task-title-${task.id}`}>{task.title}</div>
        <time className="task-date" dateTime={task.createdAt} data-testid={`text-task-date-${task.id}`}>{friendlyDate(task.createdAt)}</time>
      </div>
      <button
        type="button"
        className="delete-button"
        aria-label={`Eliminar ${task.title}`}
        title="Eliminar tarea"
        disabled={busy}
        onClick={() => removeTask(task)}
        data-testid={`button-delete-task-${task.id}`}
      >
        <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </li>
  );

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand" data-testid="text-brand">
          <span className="brand-mark"><CheckCheck size={17} strokeWidth={2.2} aria-hidden="true" /></span>
          <span>daymark</span>
        </div>
        <div className="day-note">Un pequeño avance cada día</div>
      </header>

      <div className="main-content">
        <section className="intro" aria-labelledby="page-title">
          <div>
            <div className="eyebrow"><span className="eyebrow-dot" /> Tu día, en orden</div>
            <h1 id="page-title">Haz espacio para<br /><em>lo importante.</em></h1>
            <p className="intro-copy">Un lugar tranquilo para reunir las pequeñas cosas, dedicarles atención y ver cuánto has avanzado.</p>
          </div>
          <div className="summary-card" aria-label="Resumen de tareas completadas" data-testid="card-task-summary">
            {summaryQuery.isLoading ? (
                <div className="progress-ring" aria-hidden="true" />
            ) : summaryQuery.isError ? (
              <div className="summary-copy" role="status" data-testid="status-summary-error">
                <strong>Recuento no disponible</strong><span>Tu lista sigue funcionando</span>
              </div>
            ) : (
              <>
                <div className="progress-ring" style={{ '--progress': `${completedRatio * 3.6}deg` } as CSSProperties} data-testid="progress-completion">
                  <strong>{completedRatio}%</strong>
                </div>
                <div className="summary-copy">
                  <strong data-testid="text-completed-count">{summary?.completed ?? 0} de {summary?.total ?? 0} completadas</strong>
                  <span data-testid="text-pending-count">{summary?.pending ?? 0} pendientes en tu lista</span>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="workspace" aria-label="Tu lista de tareas">
          <div className="task-panel">
            <div className="panel-heading">
              <div>
                <h2>La lista de hoy</h2>
                <p>Un siguiente paso claro es suficiente.</p>
              </div>
              {!tasksQuery.isLoading && !tasksQuery.isError && (
                <span className="count-pill" data-testid="text-task-count">{tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}</span>
              )}
            </div>
            {tasksQuery.isLoading ? (
              <div className="loading-list" aria-label="Cargando tareas" data-testid="status-loading-tasks">
                {[0, 1, 2].map((item) => <div className="skeleton-row" key={item}><span className="skeleton-dot" /><span className="skeleton-line" /></div>)}
              </div>
            ) : tasksQuery.isError ? (
              <div className="error-state" role="alert" data-testid="status-task-error">
                <p>No se pudo cargar tu lista en este momento.</p>
                <button type="button" className="retry-button" onClick={() => { void tasksQuery.refetch(); void summaryQuery.refetch(); }} data-testid="button-retry-tasks">Intentar de nuevo</button>
              </div>
            ) : tasks.length === 0 ? (
              <div className="empty-state" data-testid="status-empty-tasks">
                <span className="empty-art"><Sprout size={24} strokeWidth={1.6} aria-hidden="true" /></span>
                <h3>Un nuevo comienzo.</h3>
                <p>Tu lista está vacía. Añade una pequeña cosa a la que quieras dedicarle tiempo hoy.</p>
              </div>
            ) : (
              <ul className="task-list" aria-label="Tareas" data-testid="list-tasks">
                {pendingTasks.map(renderTask)}
                {completedTasks.map((task, index) => renderTask(task, pendingTasks.length + index))}
              </ul>
            )}
            {taskError && <p className="task-feedback" role="alert" data-testid="status-task-action-error">{taskError}</p>}
          </div>

          <aside className="add-panel" aria-labelledby="add-task-title">
            <div className="add-kicker">Una cosa a la vez</div>
            <h2 id="add-task-title">Añade algo a tu día</h2>
            <p>Sácalo de tu cabeza y ponlo en la lista.</p>
            <form className="task-form" onSubmit={submitTask}>
              <label className="sr-only" htmlFor="new-task-title">Nombre de la tarea</label>
              <input
                id="new-task-title"
                className="task-input"
                type="text"
                maxLength={200}
                value={title}
                onChange={(event) => { setTitle(event.target.value); setCreateError(''); }}
                placeholder="¿Qué tienes que hacer?"
                aria-label="Nombre de la tarea"
                data-testid="input-task-title"
              />
              <button className="submit-button" type="submit" disabled={!title.trim() || createTask.isPending} data-testid="button-create-task">
                <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
                {createTask.isPending ? 'Añadiendo…' : 'Añadir tarea'}
              </button>
            </form>
            <div className="form-hint" aria-live="polite" data-testid="status-create-task">{createError || (createTask.isPending ? 'Guardando la tarea…' : 'Hasta 200 caracteres')}</div>
            {createError && <p className="feedback" role="alert" data-testid="status-create-error">{createError}</p>}
          </aside>
        </section>
        <footer className="footer-note">
          <span>Los pequeños pasos también te hacen avanzar.</span>
          <span data-testid="text-summary-footer">{summary?.total ?? 0} en total · {summary?.completed ?? 0} completadas</span>
        </footer>
      </div>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
