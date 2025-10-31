import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function TraceGraph({ traceResults }) {
  if (!traceResults || traceResults.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No trace data available for visualization
      </div>
    );
  }

  // Prepare data for hop distribution chart
  const hopData = traceResults.reduce((acc, result) => {
    const hop = result.hop;
    acc[hop] = (acc[hop] || 0) + 1;
    return acc;
  }, {});

  const hopChartData = Object.entries(hopData).map(([hop, count]) => ({
    hop: `Hop ${hop}`,
    count,
    wallets: count
  }));

  // Prepare data for balance distribution
  const balanceData = traceResults
    .filter(result => result.current_balance > 0)
    .map(result => ({
      wallet: result.wallet.slice(0, 8) + '...',
      balance: result.current_balance,
      hop: result.hop
    }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10); // Top 10 by balance

  // Colors for different hops
  const COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6'];

  return (
    <div className="space-y-8">
      {/* Hop Distribution Chart */}
      <div>
        <h4 className="text-lg font-semibold mb-4">Wallet Distribution by Hop Distance</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hopChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="hop" 
                stroke="#9CA3AF"
                fontSize={12}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
              />
              <Bar 
                dataKey="count" 
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Balance Distribution Chart */}
      {balanceData.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold mb-4">Top Wallets by Token Balance</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={balanceData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  type="number"
                  stroke="#9CA3AF"
                  fontSize={12}
                />
                <YAxis 
                  dataKey="wallet"
                  type="category"
                  stroke="#9CA3AF"
                  fontSize={12}
                  width={100}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                  formatter={(value, name) => [
                    `${value.toFixed(0)} tokens`,
                    'Balance'
                  ]}
                />
                <Bar 
                  dataKey="balance" 
                  fill="#10B981"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-700 rounded-lg p-4">
          <h5 className="text-sm font-medium text-gray-400 mb-1">Total Flagged</h5>
          <p className="text-2xl font-bold text-red-400">{traceResults.length}</p>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <h5 className="text-sm font-medium text-gray-400 mb-1">Currently Holding</h5>
          <p className="text-2xl font-bold text-yellow-400">
            {traceResults.filter(r => r.current_holds).length}
          </p>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <h5 className="text-sm font-medium text-gray-400 mb-1">Max Hop Distance</h5>
          <p className="text-2xl font-bold text-blue-400">
            {Math.max(...traceResults.map(r => r.hop))}
          </p>
        </div>
      </div>
    </div>
  );
}

export default TraceGraph;
