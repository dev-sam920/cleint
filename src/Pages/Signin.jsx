import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import './Signin.css';

export default function Signin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let newErrors = {};

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.email) newErrors.email = 'Email is required';
    else if (!emailRegex.test(formData.email)) newErrors.email = 'Enter a valid email';

    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';

    if (Object.keys(newErrors).length === 0) {
      fetch(`${API_BASE}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email.trim().toLowerCase(), password: formData.password })
      })
        .then((res) => res.json().then((data) => ({ status: res.status, data })))
        .then(({ status, data }) => {
          if (status >= 400) {
            setErrors({ email: data.error || 'Sign in failed', password: data.error || 'Sign in failed' });
            return;
          }

          localStorage.setItem('authToken', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          setSuccess(true);
          setFormData({ email: '', password: '' });

          setTimeout(() => {
            setSuccess(false);
            navigate('/dashboard');
          }, 800);
        })
        .catch(() => {
          setErrors({ general: 'Network error while signing in' });
        });
    } else {
      setErrors(newErrors);
    }
  };

  return (
    <div className="signin-container">
      <div className="signin-card">
        <div className="card-header">
          <div className="icon-circle">🔐</div>
          <h1>Welcome Back</h1>
          <p className="subtitle">Sign in to your account</p>
        </div>

        {success && (
          <div className="success-message">
            ✓ Sign in successful! 
          </div>
        )}

        <form onSubmit={handleSubmit} className="signin-form">
          <div className="form-group">
            <label htmlFor="email">
              <span className="icon">✉️</span> Email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              className={errors.email ? 'input-error' : ''}
            />
            {errors.email && <span className="error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <span className="icon">🔒</span> Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className={errors.password ? 'input-error' : ''}
            />
            {errors.password && <span className="error">{errors.password}</span>}
          </div>

          <button type="submit" className="btn-signin">
            Sign In
          </button>
        </form>

        {errors.general && <div className="error general-error">{errors.general}</div>}

        <div className="divider"></div>

        <p className="signup-link">
          Don't have an account? <button type="button" className="link-button" onClick={() => navigate('/signup')}>
            Sign up here
          </button>
        </p>
      </div>
    </div>
  );
}
