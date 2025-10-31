import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

function Profile() {
  const { address } = useParams();
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (address) {
      fetchWalletData();
    }
  }, [address]);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://chatscanfun.vercel.app'}/api/wallets/${address}/devsnoop`);
      
      if (response.ok) {
        const data = await response.json();
        setWalletData(data);
      } else {
        setError('Failed to fetch wallet data');
      }
    } catch (err) {
      setError('Error fetching wallet data');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-layout">
      <Sidebar />
      
      <div className="main-content">
        <Header />
        
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg p-6">
            <h1 className="text-2xl font-bold mb-4">Wallet Analysis</h1>
            <p className="text-gray-400 mb-6">Address: {address}</p>
            
            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-400">Loading wallet data...</p>
              </div>
            )}
            
            {error && (
              <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
                <p className="text-red-400">Error: {error}</p>
              </div>
            )}
            
            {walletData && !loading && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-2">Dev Funding Status</h3>
                    <div className={`text-2xl font-bold ${
                      walletData.isFunded ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {walletData.isFunded ? '🚨 FLAGGED' : '✅ CLEAN'}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      {walletData.isFunded ? 'This wallet received dev funding' : 'No dev funding detected'}
                    </p>
                  </div>
                  
                  {walletData.isFunded && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-2">Minimum Hop Distance</h3>
                      <div className="text-2xl font-bold text-yellow-400">
                        {walletData.minHop} hop{walletData.minHop !== 1 ? 's' : ''}
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        Closest connection to dev wallet
                      </p>
                    </div>
                  )}
                </div>
                
                {walletData.tokens && walletData.tokens.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4">Associated Tokens</h3>
                    <div className="space-y-2">
                      {walletData.tokens.map((token, index) => (
                        <div key={index} className="flex justify-between items-center bg-gray-600 rounded p-3">
                          <div>
                            <p className="font-mono text-sm">{token.mint}</p>
                            <p className="text-xs text-gray-400">Token ID: {token.tokenId}</p>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-1 bg-yellow-600 text-yellow-100 rounded text-xs">
                              {token.hop} hop{token.hop !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2">Analysis Summary</h3>
                  <p className="text-gray-300">
                    {walletData.isFunded 
                      ? `This wallet has been flagged for receiving dev funding through ${walletData.minHop} hop${walletData.minHop !== 1 ? 's' : ''} and is associated with ${walletData.tokens?.length || 0} token${walletData.tokens?.length !== 1 ? 's' : ''}.`
                      : 'This wallet appears to be clean with no detected dev funding patterns.'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
