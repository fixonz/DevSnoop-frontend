import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { DevappProvider, UserButton, fetchPumpFunTrends, useDevapp } from '@devfunlabs/web-sdk';
import Dashboard from './pages/Dashboard';
import TokenDetail from './pages/TokenDetail';
import Profile from './pages/Profile';
import './App.css';

function App() {
  return (
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#9333ea',
          logo: '/logo.png',
        },
        loginMethods: ['wallet', 'email', 'google', 'twitter'],
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          noPromptOnSignature: false,
        },
        legal: {
          termsAndConditionsUrl: 'https://chatscanfun.vercel.app/terms',
          privacyPolicyUrl: 'https://chatscanfun.vercel.app/privacy',
        },
        mfa: {
          noPromptOnMfaRequired: false,
        },
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors(),
          },
        },
        // Add explicit origin configuration
        _unsafe_allowCrossOriginIframe: true,
        // Disable problematic features that cause JSON parsing issues
        _unsafe_disableEmbeddedWallets: false,
      }}
    >
      <DevappProvider 
        rpcEndpoint="https://rpc.dev.fun/834546a696ba7c294d95" 
        devbaseEndpoint="https://devbase.dev.fun" 
        appId="834546a696ba7c294d95"
      >
        <Router>
          <div className="min-h-screen bg-gray-900 text-gray-50">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/token/:mint" element={<TokenDetail />} />
              <Route path="/profile/:address" element={<Profile />} />
            </Routes>
          </div>
        </Router>
      </DevappProvider>
    </PrivyProvider>
  );
}

export default App;
