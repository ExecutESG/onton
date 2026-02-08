export type GeneralFormErrors = {
  title?: string[];
  subtitle?: string[];
  description?: string[];
  image_url?: string[];
  hub?: string[];
  // registration
  has_registration?: string[];
  has_approval?: string[];
  capacity?: string[];
  category_id?: string[];
};

export type TimePlaceFormErorrs = {
  start_date?: string[];
  end_date?: string[];
  timezone?: string[];
  location?: string[];
  duration?: string[];
  cityId?: string[];
  countryId?: string[];
};

export type RewardFormErrors = {
  secret_phrase?: string[];
  ts_reward_url?: string[];
  video_url?: string[];
};
