function Header() {
  return (
    <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CS</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">ChatScan.fun</h1>
              <p className="text-xs text-gray-400">Snoop the Pump, Save the Hype</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-2 text-sm text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>System Online</span>
          </div>
          
          <div className="text-sm text-gray-400">
            <span className="text-gray-500">Powered by</span>
            <span className="ml-1 font-medium text-blue-400">Helius</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
