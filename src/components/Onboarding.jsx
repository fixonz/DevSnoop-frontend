import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, MessageCircle, TrendingUp, Users, Shield, Zap, ArrowLeft } from 'lucide-react';

const Onboarding = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: MessageCircle,
      title: 'Live Chat Analysis',
      description: 'Monitor real-time chat messages from PumpFun streams. See sentiment, wallet balances, and identify potential risks.',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: TrendingUp,
      title: 'Token Analytics',
      description: 'Get comprehensive token data including market cap, holders, price trends, and dev wallet analysis.',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Users,
      title: 'Top Chatters',
      description: 'Track the most active chatters, their token holdings, and identify coordinated activity patterns.',
      color: 'from-green-500 to-teal-500',
    },
    {
      icon: Shield,
      title: 'Risk Detection',
      description: 'Identify dev wallet clusters, coordinated buys, and potential scams with our advanced analysis.',
      color: 'from-orange-500 to-red-500',
    },
    {
      icon: Zap,
      title: 'Ready to Start',
      description: 'Click on any token card to view detailed analysis and live chat. Stay ahead of the game!',
      color: 'from-purple-500 via-pink-500 to-purple-500',
    },
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipOnboarding = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    onComplete();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden"
      >
        {/* Background Effects - Same as intro animation */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Animated background particles */}
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-purple-500 rounded-full"
              initial={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                opacity: 0,
              }}
              animate={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/20" />
        </div>

        {/* Main Content */}
        <div className="relative z-10 w-full max-w-md mx-auto px-6">
          {/* Skip Button */}
          <div className="absolute top-6 right-6">
            <button
              onClick={skipOnboarding}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              Skip
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex justify-center gap-2 mb-8">
            {steps.map((_, index) => (
              <motion.div
                key={index}
                className={`h-1 rounded-full ${
                  index === currentStep
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 w-8'
                    : index < currentStep
                    ? 'bg-purple-500/50 w-4'
                    : 'bg-gray-700 w-2'
                }`}
                initial={{ width: 0 }}
                animate={{ width: index === currentStep ? 32 : index < currentStep ? 16 : 8 }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="text-center space-y-8"
            >
              {/* Icon */}
              <motion.div
                className="flex justify-center"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${steps[currentStep].color} p-6 flex items-center justify-center shadow-2xl`}>
                  {/* { steps[currentStep].icon && <steps[currentStep].icon className="w-12 h-12 text-white" /> */}
                  <MessageCircle className="w-12 h-12 text-white" />
                </div>
              </motion.div>

              {/* Title */}
              <motion.h2
                className={`text-3xl font-black bg-gradient-to-r ${steps[currentStep].color} bg-clip-text text-transparent`}
                style={{
                  fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                  letterSpacing: "0.05em",
                }}
              >
                {steps[currentStep].title}
              </motion.h2>

              {/* Description */}
              <motion.p
                className="text-gray-400 text-lg leading-relaxed"
                style={{
                  fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {steps[currentStep].description}
              </motion.p>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-8">
                <button
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full transition-all ${
                    currentStep === 0
                      ? 'opacity-0 pointer-events-none'
                      : 'bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                  style={{
                    fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>

                <button
                  onClick={nextStep}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r ${steps[currentStep].color} text-white font-semibold hover:scale-105 transition-transform shadow-lg`}
                  style={{
                    fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                  }}
                >
                  {currentStep === steps.length - 1 ? 'Get Started' : ''}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Bottom decoration */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
            <div className="flex items-center space-x-2 text-gray-600">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              <span className="text-sm">Step {currentStep + 1} of {steps.length}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Onboarding;
