import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import './Dashboard.css';

const INITIAL_TASKS = [
  { id: 1, title: 'Design UI wireframe', description: 'Create dashboard components and style', dueDate: '2026-04-01', priority: 'High', category: 'Design', completed: false },
  { id: 2, title: 'Build signup flow', description: 'Implement auth and validation', dueDate: '2026-03-30', priority: 'Medium', category: 'Dev', completed: true },
  { id: 3, title: 'Prepare project docs', description: 'Write setup instructions', dueDate: '2026-03-29', priority: 'Low', category: 'Docs', completed: false }
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [activeSection, setActiveSection] = useState('Dashboard');
  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', dueDate: '', priority: 'Medium', category: '', image: null });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : null;
  };

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      navigate('/signin');
      return;
    }

    try {
      setUser(JSON.parse(stored));
    } catch {
      navigate('/signin');
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) {
      navigate('/signin');
      return;
    }

    fetch(`${API_BASE}/tasks`, { headers })
      .then((res) => res.json().then((data) => ({ status: res.status, data })))
      .then(({ status, data }) => {
        if (status >= 400) {
          console.error('Task fetch failed', data);
          setTasks(INITIAL_TASKS);
          return;
        }

        const mapped = Array.isArray(data)
          ? data.map((t) => ({ ...t, id: t._id }))
          : INITIAL_TASKS;

        setTasks(mapped);
      })
      .catch((err) => {
        console.error('Network error fetching tasks', err);
        setTasks(INITIAL_TASKS);
      });
  }, [navigate]);


  const statistics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed).length;
    const pending = total - completed;
    return { total, completed, pending, productivity: total ? Math.round((completed / total) * 100) : 0 };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const now = new Date();
    return tasks.filter((task) => {
      const matchesQuery = task.title.toLowerCase().includes(query.toLowerCase()) || task.description.toLowerCase().includes(query.toLowerCase());
      if (!matchesQuery) return false;

      const date = new Date(task.dueDate);
      switch (selectedFilter) {
        case 'Today':
          return date.toDateString() === now.toDateString();
        case 'Upcoming':
          return date > now;
        case 'Completed':
          return task.completed;
        case 'All':
        default:
          return true;
      }
    });
  }, [tasks, query, selectedFilter]);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/signin');
  };

  const updateTask = async (id, updates) => {
    const headers = getAuthHeaders();
    if (!headers) {
      navigate('/signin');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        throw new Error('Failed to update task');
      }
      const updated = await res.json();
      setTasks((prev) => prev.map((task) => (task.id === id ? { ...updated, id: updated._id } : task)));
    } catch (error) {
      console.error('Update task error:', error);
    }
  };

  const toggleComplete = (id) => {
    const task = tasks.find((taskEl) => taskEl.id === id);
    if (!task) return;

    const toggled = !task.completed;
    updateTask(id, { completed: toggled });
  };

  const deleteTask = async (id) => {
    const taskToDelete = tasks.find((task) => task.id === id);
    const confirmMessage = taskToDelete
      ? `Are you sure you want to delete "${taskToDelete.title}"? This cannot be undone.`
      : 'Are you sure you want to delete this task?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) {
      navigate('/signin');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'DELETE',
        headers
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete task');
      }

      setTasks((prev) => prev.filter((task) => task.id !== id));
    } catch (error) {
      console.error('Delete task error:', error);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewTask((p) => ({ ...p, image: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    const title = newTask.title.trim();
    if (!title || !newTask.dueDate) return;

    const headers = getAuthHeaders();
    if (!headers) {
      navigate('/signin');
      return;
    }

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', newTask.description.trim());
      formData.append('dueDate', newTask.dueDate);
      formData.append('priority', newTask.priority);
      formData.append('category', newTask.category.trim() || 'General');

      // If we have a file (from file input), append it
      if (newTask.image && newTask.image.startsWith('data:image')) {
        // Convert base64 to blob for upload
        const response = await fetch(newTask.image);
        const blob = await response.blob();
        const file = new File([blob], 'task-image.jpg', { type: 'image/jpeg' });
        formData.append('image', file);
      }

      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: {
          Authorization: headers.Authorization // Keep auth header
        },
        body: formData // Use FormData instead of JSON
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add task');
      }

      const created = await res.json();
      setTasks((prev) => [{ ...created, id: created._id }, ...prev]);
      setNewTask({ title: '', description: '', dueDate: '', priority: 'Medium', category: '', image: null });
      setShowModal(false);
    } catch (error) {
      console.error('Create task error:', error);
      // Fallback: try with JSON if FormData fails
      try {
        const fallbackRes = await fetch(`${API_BASE}/tasks`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title,
            description: newTask.description.trim(),
            dueDate: newTask.dueDate,
            priority: newTask.priority,
            category: newTask.category.trim() || 'General',
            image: newTask.image || null
          })
        });

        if (fallbackRes.ok) {
          const created = await fallbackRes.json();
          setTasks((prev) => [{ ...created, id: created._id }, ...prev]);
          setNewTask({ title: '', description: '', dueDate: '', priority: 'Medium', category: '', image: null });
          setShowModal(false);
          return;
        }
      } catch (fallbackError) {
        console.error('Fallback create error:', fallbackError);
      }

      // If both fail, show error
      alert('Failed to create task. Please try again.');
    }
  };

  const renderSection = () => {
    if (activeSection === 'Dashboard') {
      return (
        <>
          <section className="cards">
            <article className="card"> <h4>Total Tasks</h4><p>{statistics.total}</p></article>
            <article className="card"> <h4>Completed</h4><p>{statistics.completed}</p></article>
            <article className="card"> <h4>Pending</h4><p>{statistics.pending}</p></article>
            <article className="card"> <h4>Productivity</h4><p>{statistics.productivity}%</p></article>
          </section>

          <section className="task-section">
            <div className="task-header">
              <h2>Recent Tasks</h2>
            </div>
            <ul className="task-list">
              {tasks.slice(0, 4).map((task) => (
                <li key={task.id} className="task-card">
                  <div className="task-left">
                    <input type="checkbox" checked={task.completed} onChange={() => toggleComplete(task.id)} />
                    <div className="task-details">
                      <h4>{task.title}</h4>
                      <p>{task.description}</p>
                      <div className="task-meta">
                        <span>{task.dueDate}</span>
                        <span className="tag">{task.category}</span>
                        <span className="tag low">{task.priority}</span>
                      </div>
                    </div>
                  </div>
                  <button className="menu-btn" onClick={() => deleteTask(task.id)}>🗑</button>
                </li>
              ))}
            </ul>
          </section>
        </>
      );
    }

    if (activeSection === 'Tasks' || activeSection === 'Completed') {
      const listTasks = activeSection === 'Completed' ? tasks.filter((task) => task.completed) : filteredTasks;
      return (
        <>
          <section className="cards">
            <article className="card"> <h4>Total</h4><p>{statistics.total}</p></article>
            <article className="card"> <h4>Done</h4><p>{statistics.completed}</p></article>
            <article className="card"> <h4>Pending</h4><p>{statistics.pending}</p></article>
          </section>

          <section className="task-section">
            <div className="task-header">
              <h2>{activeSection === 'Completed' ? 'Completed Tasks' : 'Task List'}</h2>
              {activeSection === 'Tasks' && <button className="primary-btn" onClick={() => setShowModal(true)}>Add Task</button>}
            </div>

            {activeSection === 'Tasks' && (
              <div className="filters">
                {['All', 'Today', 'Upcoming', 'Completed'].map((filter) => (
                  <button key={filter} className={selectedFilter === filter ? 'filter active' : 'filter'} onClick={() => setSelectedFilter(filter)}>{filter}</button>
                ))}
              </div>
            )}

            <ul className="task-list">
              {listTasks.length === 0 ? <li className="empty-state">No tasks found.</li> : listTasks.map((task) => (
                <li className="task-card" key={task.id}>
                  {task.image && <img src={task.image} alt={task.title} className="task-image" />}
                  <div className="task-left">
                    <input type="checkbox" checked={task.completed} onChange={() => toggleComplete(task.id)} />
                    <div className="task-details">
                      <h4>{task.title}</h4>
                      <p>{task.description}</p>
                      <div className="task-meta">
                        <span>{task.dueDate}</span>
                        <span className="tag">{task.category}</span>
                        <span className="tag low">{task.priority}</span>
                      </div>
                    </div>
                  </div>
                  <button className="menu-btn" onClick={() => deleteTask(task.id)}>🗑</button>
                </li>
              ))}
            </ul>
          </section>
        </>
      );
    }

    if (activeSection === 'Settings') {
      return (
        <section className="settings-section">
          <h2>Settings</h2>
          <p>Manage your preferences and profile details.</p>
          <button className="primary-btn" onClick={handleLogout}>Logout</button>
        </section>
      );
    }

    return null;
  };

  if (!user) {
    return null;
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <h2>TodoSpace</h2>
        <nav>
          {['Dashboard', 'Tasks', 'Completed', 'Settings'].map((item) => (
            <button
              key={item}
              className={activeSection === item ? 'sidebar-item active' : 'sidebar-item'}
              onClick={() => setActiveSection(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <h3>{activeSection}</h3>
            <div className="search-wrap">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks..." />
            </div>
          </div>
          <div className="topbar-right">
            <button className="icon-btn">🔔</button>
            <div className="profile-pill">{(user.username || user.email)[0]?.toUpperCase()}</div>
          </div>
        </header>

        {renderSection()}
      </main>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Task</h3>
            <form onSubmit={handleAddTask}>
              <label>Title<input value={newTask.title} onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))} required /></label>
              <label>Description<textarea value={newTask.description} onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))} /></label>
              <label>Due Date<input type="date" value={newTask.dueDate} onChange={(e) => setNewTask((p) => ({ ...p, dueDate: e.target.value }))} required /></label>
              <label>Priority<select value={newTask.priority} onChange={(e) => setNewTask((p) => ({ ...p, priority: e.target.value }))}>
                <option>Low</option><option>Medium</option><option>High</option>
              </select></label>
              <label>Category<input value={newTask.category} onChange={(e) => setNewTask((p) => ({ ...p, category: e.target.value }))} /></label>
              <label>Image<input type="file" accept="image/*" onChange={handleImageUpload} /></label>
              {newTask.image && <div className="image-preview"><img src={newTask.image} alt="Preview" /></div>}
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="primary-btn">Save Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
