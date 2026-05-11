import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { Button, Input, Modal, Alert } from '../components/ui/index.js';

export function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, requestMagicCode, loginWithMagicCode, error, clearError, isAuthenticated, isVerified } = useAuthStore();
  
  const [isLogin, setIsLogin] = useState(location.pathname === '/login');

  // Redirect if already authenticated and verified
  useEffect(() => {
    if (isAuthenticated() && isVerified()) {
      navigate('/dashboard');
    }
  }, [navigate, isAuthenticated, isVerified]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMagicCodeModal, setShowMagicCodeModal] = useState(false);
  const [magicCodeStep, setMagicCodeStep] = useState('request'); // 'request' or 'code'
  const [magicCode, setMagicCode] = useState('');
  const [magicCodeLoading, setMagicCodeLoading] = useState(false);
  const [magicCodeSent, setMagicCodeSent] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Update isLogin when route changes
  useEffect(() => {
    setIsLogin(location.pathname === '/login');
  }, [location.pathname]);

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
        navigate('/');
      } else {
        // After registration, show success message and switch to login
        setSuccessMessage(result.message || 'Registration successful! Please sign in.');
        setIsLogin(true);
        setPassword('');
        setConfirmPassword('');
        // Clear success message after 5 seconds
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
      navigate('/');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-gray-600">
            {isLogin ? 'Sign in to your account' : 'Sign up to get started'}
          </p>
        </div>

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

        <form onSubmit={handlePasswordSubmit} className="space-y-6">
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

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={loading || (!isLogin && password !== confirmPassword)}
            loading={loading}
          >
            {isLogin ? 'Sign In' : 'Sign Up'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {isLogin ? (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => {
                    setIsLogin(false);
                    setPassword('');
                    clearError();
                  }}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => {
                    setIsLogin(true);
                    setPassword('');
                    setConfirmPassword('');
                    clearError();
                  }}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Magic Code Modal - commented out for now */}
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
    </div>
  );
}
