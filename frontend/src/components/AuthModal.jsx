import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { Button, Input, Modal, Alert } from './ui/index.js';

export function AuthModal({ isOpen, onClose, initialMode = 'login' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, requestMagicCode, loginWithMagicCode, error, clearError, isAuthenticated, isVerified } = useAuthStore();
  
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMagicCodeModal, setShowMagicCodeModal] = useState(false);
  const [magicCodeStep, setMagicCodeStep] = useState('request');
  const [magicCode, setMagicCode] = useState('');
  const [magicCodeLoading, setMagicCodeLoading] = useState(false);
  const [magicCodeSent, setMagicCodeSent] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Update isLogin based on route or initialMode
  useEffect(() => {
    if (location.pathname === '/login') {
      setIsLogin(true);
    } else if (location.pathname === '/register') {
      setIsLogin(false);
    } else {
      setIsLogin(initialMode === 'login');
    }
  }, [location.pathname, initialMode]);

  // Close modal if user becomes authenticated
  useEffect(() => {
    // Only redirect if modal is open and user becomes authenticated
    if (isOpen && isAuthenticated() && isVerified()) {
      onClose();
      navigate('/dashboard');
    }
  }, [isOpen, navigate, onClose]); // Remove function dependencies, call them inside

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setSuccessMessage('');
      setShowMagicCodeModal(false);
      setMagicCodeStep('request');
      setMagicCode('');
      clearError();
    }
  }, [isOpen, clearError]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setLoading(true);

    const result = isLogin 
      ? await login(email, password)
      : await register(email, password);
    
    setLoading(false);

    if (result.success) {
      if (isLogin) {
        onClose();
        navigate('/dashboard');
      } else {
        // After registration, show success message and switch to login
        setSuccessMessage(result.message || 'Registration successful! Please sign in.');
        setIsLogin(true);
        setPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setSuccessMessage('');
        }, 5000);
      }
    }
  };

  const handleRequestMagicCode = async () => {
    if (!email) {
      return;
    }

    clearError();
    setMagicCodeLoading(true);

    const result = await requestMagicCode(email);
    setMagicCodeLoading(false);

    if (result.success) {
      setMagicCodeSent(true);
      setMagicCodeStep('code');
    }
  };

  const handleMagicCodeSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setMagicCodeLoading(true);

    const result = await loginWithMagicCode(magicCode.trim().toUpperCase());
    setMagicCodeLoading(false);

    if (result.success) {
      setShowMagicCodeModal(false);
      onClose();
      navigate('/dashboard');
    }
  };

  const openMagicCodeModal = () => {
    if (!email) {
      return;
    }
    setShowMagicCodeModal(true);
    setMagicCodeStep('request');
    setMagicCodeSent(false);
    setMagicCode('');
    clearError();
  };

  const closeMagicCodeModal = () => {
    setShowMagicCodeModal(false);
    setMagicCodeStep('request');
    setMagicCodeSent(false);
    setMagicCode('');
    clearError();
  };

  const passwordError = !isLogin && password && confirmPassword && password !== confirmPassword 
    ? 'Passwords do not match' 
    : null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isLogin ? 'Sign In' : 'Create Account'}
        size="md"
      >
        {successMessage && (
          <Alert variant="success" className="mb-4">
            {successMessage}
          </Alert>
        )}

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <Input
              label="Email"
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            {/* Magic code button - commented out for now */}
            {/* <button
              type="button"
              onClick={openMagicCodeModal}
              disabled={!email}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Use magic code instead
            </button> */}
          </div>

          <Input
            label="Password"
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={isLogin ? undefined : 8}
            helperText={!isLogin ? 'Must be at least 8 characters' : undefined}
          />

          {!isLogin && (
            <Input
              label="Confirm Password"
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              error={passwordError}
            />
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={loading || (!isLogin && password !== confirmPassword)}
              loading={loading}
            >
              {isLogin ? 'Sign In' : 'Sign Up'}
            </Button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            {isLogin ? (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => setIsLogin(false)}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => setIsLogin(true)}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </Modal>

      {/* Nested Magic Code Modal - commented out for now */}
      {/*
      <Modal
        isOpen={showMagicCodeModal}
        onClose={closeMagicCodeModal}
        title="Magic Code Authentication"
        size="md"
      >
        {magicCodeStep === 'request' ? (
          <div className="space-y-4">
            <Alert variant="info">
              <div>
                <p className="font-semibold mb-2">How it works:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>A magic code will be generated and printed to the server console</li>
                  <li>Ask your administrator to retrieve the code for you</li>
                  <li>Enter the code below to {isLogin ? 'sign in' : 'register'}</li>
                </ul>
              </div>
            </Alert>

            <div>
              <p className="text-sm text-gray-700 mb-2">
                <strong>Email:</strong> {email}
              </p>
            </div>

            {error && (
              <Alert variant="error">
                {error}
              </Alert>
            )}

            <Button
              onClick={handleRequestMagicCode}
              variant="primary"
              className="w-full"
              loading={magicCodeLoading}
            >
              Generate Magic Code
            </Button>
          </div>
        ) : (
          <form onSubmit={handleMagicCodeSubmit} className="space-y-4">
            {magicCodeSent && (
              <Alert variant="success">
                Code generated! Ask your administrator to retrieve it from the console.
              </Alert>
            )}

            <Input
              label="Magic Code"
              type="text"
              id="magicCode"
              value={magicCode}
              onChange={(e) => {
                const trimmed = e.target.value.trimStart().toUpperCase();
                setMagicCode(trimmed.slice(0, 6));
              }}
              placeholder="ABC123"
              required
              maxLength={7}
              className="text-center text-2xl font-mono tracking-widest"
              helperText="Enter the 6-character code"
            />

            {error && (
              <Alert variant="error">
                {error}
              </Alert>
            )}

            <div className="flex space-x-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setMagicCodeStep('request');
                  setMagicCode('');
                  clearError();
                }}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                disabled={magicCodeLoading || magicCode.length !== 6}
                loading={magicCodeLoading}
              >
                Verify Code
              </Button>
            </div>
          </form>
        )}
      </Modal>
      */}
    </>
  );
}

