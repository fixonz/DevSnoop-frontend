import { useState } from 'react';

function TokenInput({ onTokenAdded, onCancel }) {
  const [mint, setMint] = useState('');
  const [devWallet, setDevWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mint.trim()) {
      setError('Mint address is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://chatscanfun.vercel.app'}/api/tokens/trace`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mint: mint.trim(),
          devWallet: devWallet.trim() || undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start trace');
      }

      onTokenAdded({
        id: data.tokenId,
        mint: mint.trim(),
        dev_wallet: devWallet.trim() || 'Auto-detected',
        trace_status: data.status,
        risk_score: data.riskScore || 0,
        flaggedCount: data.flaggedCount || 0,
        totalRecipients: data.totalRecipients || 0,
        trace_results: data.results || []
      });

      setMint('');
      setDevWallet('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="mint" className="block text-sm font-medium text-gray-300 mb-2">
          Token Mint Address *
        </label>
        <input
          type="text"
          id="mint"
          value={mint}
          onChange={(e) => setMint(e.target.value)}
          placeholder="Enter Solana token mint address..."
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="devWallet" className="block text-sm font-medium text-gray-300 mb-2">
          Dev Wallet Address (Optional)
        </label>
        <input
          type="text"
          id="devWallet"
          value={devWallet}
          onChange={(e) => setDevWallet(e.target.value)}
          placeholder="Leave empty to auto-detect..."
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
        <p className="text-xs text-gray-500 mt-1">
          If not provided, we'll attempt to detect the dev wallet from the mint transaction
        </p>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-900 bg-opacity-20 p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex space-x-3">
        <button
          type="submit"
          disabled={loading || !mint.trim()}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
        >
          {loading ? (
            <>
              <div className="spinner mr-2"></div>
              Running Trace...
            </>
          ) : (
            'Run ChatScan Analysis'
          )}
        </button>
        
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default TokenInput;
