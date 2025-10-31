function RecentTraces({ tokens, onTokenSelect }) {
  const recentTokens = tokens.slice(0, 5); // Show last 5

  if (recentTokens.length === 0) {
    return null;
  }

  const getRiskEmoji = (riskScore) => {
    if (riskScore < 20) return '✅';
    if (riskScore < 50) return '🟡';
    return '🔴';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'running': return 'text-yellow-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Recent Traces</h3>
      
      <div className="space-y-3">
        {recentTokens.map((token) => (
          <div
            key={token.id}
            onClick={() => onTokenSelect(token)}
            className="p-4 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium text-white truncate">
                    {token.mint.slice(0, 12)}...{token.mint.slice(-8)}
                  </p>
                  {token.trace_status === 'completed' && (
                    <span className="text-lg">
                      {getRiskEmoji(token.risk_score)}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center space-x-4 mt-1">
                  <span className={`text-xs ${getStatusColor(token.trace_status)}`}>
                    {token.trace_status}
                  </span>
                  
                  {token.trace_status === 'completed' && (
                    <>
                      <span className="text-xs text-gray-400">
                        {token.flaggedCount || 0} flagged
                      </span>
                      <span className="text-xs text-gray-400">
                        {token.risk_score || 0}% risk
                      </span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {token.trace_status === 'running' && (
                  <div className="spinner"></div>
                )}
                <svg 
                  className="w-4 h-4 text-gray-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {tokens.length > 5 && (
        <div className="mt-4 text-center">
          <button className="text-sm text-blue-400 hover:text-blue-300">
            View All Traces
          </button>
        </div>
      )}
    </div>
  );
}

export default RecentTraces;
