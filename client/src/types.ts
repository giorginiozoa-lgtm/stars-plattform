// Gemeinsame Typdefinitionen (spiegeln die Backend-Antworten wider).
export type Role = 'entrepreneur' | 'mentor' | 'admin';

export interface User {
  id: number;
  name: string;
  role: Role;
  country?: string;
  region?: string;
  headline?: string;
  bio?: string;
  languages: string[];
  avatar_seed: string;
  support_roles?: SupportRole[];
  capacity_hours?: number | null;
  available?: boolean;
  offers_peer_support?: boolean;
  status?: 'pending' | 'active' | 'rejected';
}

export interface Tag {
  id: number;
  slug: string;
  name_de: string;
  name_en: string;
  category: 'domain' | 'stage' | 'market' | 'skill' | 'network';
  weight?: number;
}

export interface Forum {
  id: number;
  slug: string;
  title_de: string;
  title_en: string;
  description_de?: string;
  description_en?: string;
  thread_count?: number;
  last_activity?: string | null;
}

export interface Thread {
  id: number;
  forum_id: number;
  title: string;
  body: string;
  created_at: string;
  author_id?: number;
  author_name?: string;
  author_role?: Role;
  author_avatar?: string;
  comment_count?: number;
}

export interface Comment {
  id: number;
  body: string;
  created_at: string;
  author_id: number;
  author_name: string;
  author_role: Role;
  author_avatar: string;
}

export interface Question {
  id: number;
  asker_id: number;
  asker_name?: string;
  asker_avatar?: string;
  asker_country?: string;
  title: string;
  body: string;
  status: 'open' | 'matched' | 'resolved';
  created_at: string;
  tags?: Tag[];
}

export interface Match {
  id?: number;
  mentor_id: number;
  mentor_name: string;
  headline?: string;
  country?: string;
  region?: string;
  avatar_seed?: string;
  score: number;
  status?: 'suggested' | 'accepted' | 'declined';
  coverage?: number;
  expertise?: number;
  market?: number;
  matchedTags?: { de: string; en: string }[];
}

export interface LearningModule {
  id: number;
  slug: string;
  title_de: string;
  title_en: string;
  description_de?: string;
  description_en?: string;
  video_url?: string;
  duration_min: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  tags: Tag[];
  progress: number;
  completed: boolean;
}

export interface Conversation {
  id: number;
  partner: User;
  lastMessage?: { body: string; sender_id: number; created_at: string } | null;
  unread: number;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body?: string;
  link?: string;
  read_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Iteration 2: Support Journey und Communities of Practice
// ---------------------------------------------------------------------------
export type SupportRole = 'lead_mentor' | 'expert' | 'connector';
export type Step =
  | 'intake' | 'assessment' | 'prioritization' | 'support_plan' | 'matching'
  | 'agreement' | 'implementation' | 'reassessment' | 'closed';
export type Format =
  | 'mentoring' | 'skills' | 'education' | 'knowledge_sharing'
  | 'introductions' | 'partnerships' | 'projects' | 'stage';
export type CaseType = 'venture_scaler' | 'ecosystem_builder';
export type Answers = Record<string, string | string[]>;

export interface EemProfile {
  case_type: CaseType | null;
  context: Answers;
  ecosystem: Answers;
  venture: Answers;
  entrepreneur: Answers;
  validated_at: string | null;
  updated_at: string;
}

export interface Handover {
  next: Step | null;
  canAdvance: boolean;
  missing: { code: string; de: string; en: string }[];
}

export interface CaseRow {
  id: number;
  eem_id: number;
  coordinator_id: number | null;
  step: Step;
  intake_decision: 'pending' | 'accepted' | 'declined';
  motivation: string | null;
  expectations: string | null;
  plan_consent_at: string | null;
  cycle: number;
  closed_reason: 'goal_achieved' | 'eem_request' | 'no_further_need' | 'declined' | null;
  closing_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseListItem extends CaseRow {
  eem: User;
  case_type: CaseType | null;
  prioritized: { id: number; goal: string; status: string }[];
  next_review: string | null;
  handover: Handover;
  my_invitations?: { id: number; status: string; supporter_ok: number; role: SupportRole; goal: string }[];
}

export interface PlanItem { id: number; format: Format; note: string | null }
export interface Brief {
  need_id: number;
  main_role: SupportRole;
  experience: string | null;
  context_ref: string | null;
  network_access: string | null;
  language: string | null;
  duration: string | null;
  working_mode: string | null;
}
export interface CaseMatch {
  id: number;
  need_id: number;
  supporter_id: number;
  supporter_name: string;
  supporter_headline?: string;
  supporter_avatar?: string;
  supporter_country?: string;
  role: SupportRole;
  score: number | null;
  status: 'invited' | 'confirmed' | 'declined';
  supporter_ok: number;
  eem_ok: number;
  created_at: string;
}
export interface Agreement { need_id: number; goal: string; roles: string | null; next_steps: string | null; review_date: string }
export interface Review {
  id: number;
  progress: 'none' | 'partial' | 'achieved';
  outcome: string | null;
  next_step: 'continue' | 'new_goal' | 'rematch' | 'close';
  created_at: string;
}
export interface Need {
  id: number;
  case_id: number;
  goal: string;
  bottleneck: string | null;
  support_needed: string | null;
  success_criterion: string | null;
  relevance: number | null;
  urgency: number | null;
  impact: number | null;
  stars_contribution: number | null;
  feasibility: number | null;
  priority_rank: number | null;
  status: 'open' | 'achieved' | 'dropped';
  cycle: number;
  tags: Tag[];
  plan: PlanItem[];
  brief: Brief | null;
  matches: CaseMatch[];
  agreement: Agreement | null;
  reviews: Review[];
}
export interface CaseEvent {
  id: number;
  type: 'step' | 'progress' | 'note' | 'match';
  step: Step | null;
  body: string | null;
  user_name: string | null;
  created_at: string;
}
export interface CaseDetail {
  case: CaseRow;
  access: 'admin' | 'eem' | 'supporter' | 'invited';
  eem: User;
  coordinator: User | null;
  profile: EemProfile | null;
  needs: Need[];
  events: CaseEvent[];
  handover: Handover;
  steps: Step[];
}
export interface Candidate {
  supporter: User & { capacity_hours: number | null };
  role: SupportRole;
  score: number;
  components: { expertise: number; context: number; network: number; language: number; capacity: number };
  matchedTags: { de: string; en: string }[];
  active_load: number;
  status: string | null;
}

export interface Community {
  id: number;
  slug: string;
  name_de: string;
  name_en: string;
  description_de?: string;
  description_en?: string;
  tag_name_de?: string;
  tag_name_en?: string;
  tag_category?: Tag['category'];
  member_count: number;
  post_count: number;
  next_session: string | null;
  my_role: 'member' | 'moderator' | null;
}
export interface CommunitySession {
  id: number;
  title: string;
  description: string | null;
  format: 'peer_session' | 'roundtable' | 'masterclass' | 'pitch_learn';
  starts_at: string;
  host_name: string | null;
  attendee_count: number;
  attending: number;
}
export interface CommunityPost {
  id: number;
  body: string;
  created_at: string;
  author_id: number;
  author_name: string;
  author_role: Role;
  author_avatar: string;
}

// --- Iteration 3: Netzwerkzugang, Give-back, Feedback -----------------------
export type IntroStatus = 'requested' | 'proposed' | 'accepted' | 'declined' | 'closed';
export interface IntroRequest {
  id: number;
  requester_id: number;
  requester_name: string;
  requester_country: string | null;
  requester_headline: string | null;
  requester_avatar: string | null;
  target_profile: string;
  purpose: string;
  status: IntroStatus;
  supporter_id: number | null;
  supporter_name: string | null;
  supporter_headline: string | null;
  supporter_avatar: string | null;
  vouch_note: string | null;
  response_note: string | null;
  conversation_id: number | null;
  created_at: string;
  updated_at: string;
  tags: Tag[];
}
export interface IntroSuggestion {
  user: { id: number; name: string; role: Role; country: string | null; headline: string | null; avatar_seed: string | null };
  peer: boolean;
  score: number;
  matchedTags: { de: string; en: string }[];
}
export interface StarsEvent {
  id: number;
  slug: string;
  kind: 'symposium' | 'study_tour' | 'online';
  title_de: string;
  title_en: string;
  location: string | null;
  starts_on: string;
  ends_on: string | null;
  description_de: string | null;
  description_en: string | null;
  url: string | null;
  interested_count: number;
  scholarship_count: number;
  my_status: 'interested' | 'requested' | 'granted' | 'waitlist' | 'declined' | null;
  my_scholarship: number | null;
  my_motivation: string | null;
}
export interface EventRegistration {
  event_id: number;
  user_id: number;
  scholarship: number;
  motivation: string | null;
  status: 'interested' | 'requested' | 'granted' | 'waitlist' | 'declined';
  created_at: string;
  title_de: string;
  title_en: string;
  name: string;
  country: string | null;
  headline: string | null;
  avatar_seed: string | null;
  role: Role;
}
export interface SessionRequest {
  id: number;
  community_id: number;
  requester_id: number;
  requester_name: string;
  requester_avatar: string | null;
  title: string;
  description: string | null;
  audience: string | null;
  preferred_date: string | null;
  status: 'pending' | 'approved' | 'declined';
  session_id: number | null;
  created_at: string;
}
export type FeedbackCategory = 'bug' | 'idea' | 'usability' | 'praise' | 'other';
export interface FeedbackEntry {
  id: number;
  user_id: number | null;
  user_name?: string | null;
  user_role?: Role | null;
  category: FeedbackCategory;
  area: string | null;
  rating: number | null;
  body: string;
  page: string | null;
  status: 'new' | 'in_progress' | 'done';
  response: string | null;
  created_at: string;
  updated_at: string;
}
