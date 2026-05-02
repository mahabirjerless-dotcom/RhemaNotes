import { useState, useEffect } from 'react';
import { UserTier, TIER_LIMITS, canUseFeature, FeatureLimits } from '../constants/features';

export const useSubscription = () => {
  // In a real app, this would be fetched from your Auth provider or DB
  const [tier, setTier] = useState<UserTier>('free');

  const checkFeature = (feature: keyof FeatureLimits) => {
    return canUseFeature(tier, feature);
  };

  const getLimit = (feature: keyof FeatureLimits) => {
    return TIER_LIMITS[tier][feature];
  };

  return {
    tier,
    isPro: tier === 'pro' || tier === 'church',
    isChurch: tier === 'church',
    checkFeature,
    getLimit,
    setTier, // To simulate changes for now
  };
};
