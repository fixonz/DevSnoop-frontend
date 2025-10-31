import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

function RiskCard({ token }) {
  if (!token || token.trace_status !== 'completed') {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">ChatScan Risk Analysis</h3>
        <div className="text-center py-8">
          <p className="text-gray-400">No analysis available yet</p>
          <p className="text-gray-500 text-sm mt-1">Run a trace to see risk metrics</p>
        </div>
      </div>
    );
  }

  const riskScore = token.risk_score || 0;
  const flaggedCount = token.flaggedCount || 0;
  const totalRecipients = token.totalRecipients || 0;

  const getRiskLevel = (score) => {
    if (score < 20) return { level: 'Low', color: 'text-green-400', bgColor: 'bg-green-100' };
    if (score < 50) return { level: 'Medium', color: 'text-yellow-400', bgColor: 'bg-yellow-100' };
    return { level: 'High', color: 'text-red-400', bgColor: 'bg-red-100' };
  };

  const riskLevel = getRiskLevel(riskScore);

  // Prepare data for pie chart (hop distribution)
  const hopData = [
    { name: 'Hop 1', value: token.trace_results?.filter(r => r.hop === 1 && r.ever_held).length || 0, color: '#fbbf24' },
    { name: 'Hop 2', value: token.trace_results?.filter(r => r.hop === 2 && r.ever_held).length || 0, color: '#f97316' },
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">ChatScan Risk Analysis</h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${riskLevel.bgColor} ${riskLevel.color}`}>
          {riskLevel.level} Risk
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Risk Score */}
        <div className="text-center">
          <div className="text-3xl font-bold mb-2">{riskScore}%</div>
          <div className="text-sm text-gray-400">Insider Risk Score</div>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                riskScore < 20 ? 'bg-green-500' : 
                riskScore < 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(riskScore, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Flagged Wallets */}
        <div className="text-center">
          <div className="text-3xl font-bold mb-2 text-yellow-400">{flaggedCount}</div>
          <div className="text-sm text-gray-400">Flagged Wallets</div>
          <div className="text-xs text-gray-500 mt-1">
            out of {totalRecipients} total
          </div>
        </div>

        {/* Hop Distribution */}
        <div className="text-center">
          <div className="h-20 w-20 mx-auto mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={hopData}
                  cx="50%"
                  cy="50%"
                  innerRadius={20}
                  outerRadius={35}
                  dataKey="value"
                >
                  {hopData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-sm text-gray-400">Hop Distribution</div>
          <div className="flex justify-center space-x-4 mt-1">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-400 rounded-full mr-1"></div>
              <span className="text-xs text-gray-500">Hop 1</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-orange-500 rounded-full mr-1"></div>
              <span className="text-xs text-gray-500">Hop 2</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-gray-700 rounded-lg">
        <div className="text-sm">
          <span className="text-gray-400">Analysis Summary:</span>
          <span className="ml-2">
            {flaggedCount > 0 ? (
              <>
                <span className="text-yellow-400 font-medium">{flaggedCount} wallet{flaggedCount !== 1 ? 's' : ''}</span>
                <span className="text-gray-300"> received dev funds and {flaggedCount === 1 ? 'holds' : 'hold'} this token</span>
              </>
            ) : (
              <span className="text-green-400">No insider activity detected</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

export default RiskCard;
