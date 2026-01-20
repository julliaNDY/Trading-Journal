# 📋 Epics & User Stories - New Features

> **Date** : 2026-01-14  
> **Status** : 📋 Draft  
> **Architect** : Lead Software Architect

---

## Epic 10 : Beta & Voting System

### Story 10.1 : Beta Voting Page - User Interface

**As a** trader,  
**I want** to vote on potential features/options on a dedicated Beta page,  
**so that** I can influence the product roadmap.

**Acceptance Criteria (AC)** :
1. **AC1**: New "Beta" page accessible from left sidebar (between "Account" and "Settings").
2. **AC2**: Page displays list of voting options with current vote counts.
3. **AC3**: User can vote on each option (1 vote per user per option).
4. **AC4**: User can see their own votes (highlighted/checked).
5. **AC5**: Page displays roadmap visualization (Upcoming=Orange, Completed=Green, In Progress=Blue).
6. **AC6**: Roadmap items parsed from markdown structure with status indicators.

**Tech Notes** :
- Create `src/app/(dashboard)/beta/page.tsx`
- Add route to sidebar navigation (`src/components/layout/sidebar.tsx`)
- Use shadcn/ui components (Card, Button, Badge)
- Parse roadmap markdown for status indicators (🟠 🟢 🔵)
- Store votes in DB table `Vote` (userId, optionId, createdAt)

---

### Story 10.2 : Roadmap Visualization Component

**As a** trader,  
**I want** to see the roadmap with color-coded statuses,  
**so that** I can understand what's coming and what's completed.

**Acceptance Criteria (AC)** :
1. **AC1**: Component parses roadmap markdown structure.
2. **AC2**: Status indicators mapped to colors (🟠=Orange, 🟢=Green, 🔵=Blue).
3. **AC3**: Roadmap items displayed in organized sections (by Phase/Epic).
4. **AC4**: Performance : rendering < 1s for full roadmap.
5. **AC5**: Responsive design (mobile, tablet, desktop).

**Tech Notes** :
- Create `src/components/beta/roadmap-visualization.tsx`
- Use `remark` or `markdown-to-jsx` for parsing
- Regex pattern for status indicators: `🟠|🟢|🔵`
- Cache parsed roadmap (Redis) to avoid re-parsing
- Use TailwindCSS for colors (orange-500, green-500, blue-500)

---

### Story 10.3 : Admin Votes Management - CRUD

**As an** admin,  
**I want** to manage voting options (CRUD) and view results,  
**so that** I can control what users vote on and track feedback.

**Acceptance Criteria (AC)** :
1. **AC1**: New "Votes" tab in Admin Dashboard.
2. **AC2**: Admin can create new voting options (title, description, status).
3. **AC3**: Admin can edit existing options.
4. **AC4**: Admin can delete options (with confirmation).
5. **AC5**: Admin can toggle option status (Active/Inactive).
6. **AC6**: Admin can view vote results (counts, percentages, user list).

**Tech Notes** :
- Extend `src/app/(dashboard)/admin/admin-content.tsx` with new tab
- Create `src/components/admin/votes-management.tsx`
- DB table `VotingOption` (id, title, description, status, createdAt, updatedAt)
- DB table `Vote` (id, userId, optionId, createdAt)
- Use shadcn/ui Dialog for create/edit forms
- Use shadcn/ui Table for results display

---

### Story 10.4 : Voting System Backend - Rate Limiting

**As a** platform engineer,  
**I want** a secure voting system with rate limiting,  
**so that** users can't spam votes or manipulate results.

**Acceptance Criteria (AC)** :
1. **AC1**: Server action `voteOnOption(optionId)` validates user authentication.
2. **AC2**: Rate limiting : 1 vote per user per option (prevent duplicates).
3. **AC3**: Validation : option must exist and be active.
4. **AC4**: Transaction safety : vote creation is atomic.
5. **AC5**: Audit logging : log all vote actions.

**Tech Notes** :
- Create `src/app/actions/voting.ts`
- Use Prisma transaction for vote creation
- Check existing vote before creating (unique constraint userId + optionId)
- Use `getUser()` from `@/lib/auth` for authentication
- Log votes in audit table (optional)

---

## Epic 11 : Advanced Admin & User Management

### Story 11.1 : Admin User List with Stripe Plans

**As an** admin,  
**I want** to see all users with their current Stripe subscription plans,  
**so that** I can manage subscriptions effectively.

**Acceptance Criteria (AC)** :
1. **AC1**: Admin Dashboard displays user list with columns: email, plan, status, created date.
2. **AC2**: Plan information fetched from Stripe via `subscriptions.list`.
3. **AC3**: Display plan name, interval, current period end.
4. **AC4**: Filter/search users by email, plan, status.
5. **AC5**: Performance : load user list < 2s (pagination if > 100 users).

**Tech Notes** :
- Extend `src/app/(dashboard)/admin/admin-content.tsx`
- Use Stripe API `customers.list` + `subscriptions.list`
- Cache Stripe data (Redis) to avoid excessive API calls
- Use shadcn/ui Table with pagination
- Server action `getAllUsersWithSubscriptions()`

---

### Story 11.2 : Extend/Modify/Suspend Subscriptions

**As an** admin,  
**I want** to extend, modify, or suspend user subscriptions,  
**so that** I can manage customer accounts and support requests.

**Acceptance Criteria (AC)** :
1. **AC1**: Admin can extend subscription (add days/months to current period).
2. **AC2**: Admin can modify subscription (change plan, interval).
3. **AC3**: Admin can suspend subscription (pause, cancel immediately).
4. **AC4**: All actions use Stripe API `subscriptions.update`.
5. **AC5**: Changes reflected immediately in Stripe and local DB.

**Tech Notes** :
- Use Stripe API `subscriptions.update` endpoint
- Server actions: `extendSubscription()`, `modifySubscription()`, `suspendSubscription()`
- Update Prisma `Subscription` table after Stripe update
- Use Stripe webhook to sync (backup)
- ⚠️ **NOTIFICATION PM** : Stripe API `subscriptions.update` required

---

### Story 11.3 : Email Notifications on Admin Actions

**As a** user,  
**I want** to receive email notifications when admin modifies my subscription,  
**so that** I'm informed of changes to my account.

**Acceptance Criteria (AC)** :
1. **AC1**: Email sent automatically when admin extends/modifies/suspends subscription.
2. **AC2**: Email includes custom admin comment field.
3. **AC3**: Email template includes: action taken, new plan details, admin comment, support contact.
4. **AC4**: Email sent via Resend/SendGrid API.
5. **AC5**: Email delivery tracked (success/failure logged).

**Tech Notes** :
- Use Resend API `emails.send` (or SendGrid)
- Create email template `src/emails/admin-subscription-change.tsx`
- Server action `sendSubscriptionChangeEmail(userId, action, comment)`
- Log email delivery in DB table `EmailLog`
- ⚠️ **NOTIFICATION PM** : Resend/SendGrid API required

---

### Story 11.4 : Promote User to Admin

**As an** admin,  
**I want** to promote a standard user to Admin role,  
**so that** I can delegate admin tasks.

**Acceptance Criteria (AC)** :
1. **AC1**: Admin can select user from list and promote to Admin.
2. **AC2**: Promotion adds user email to `ADMIN_EMAILS` list (or DB role field).
3. **AC3**: Promoted user gains access to Admin Dashboard.
4. **AC4**: Audit log records promotion action (who, when, which user).
5. **AC5**: Confirmation dialog before promotion.

**Tech Notes** :
- Add `role` field to `User` table (Prisma schema) or use `ADMIN_EMAILS` array
- Server action `promoteUserToAdmin(userId)`
- Update `isAdmin()` function to check role/email
- Use shadcn/ui AlertDialog for confirmation
- Log promotion in audit table

---

## Epic 12 : AI Daily Bias Analysis

### Story 12.1 : Daily Bias Page - Instrument Selection

**As a** trader,  
**I want** to select an instrument and request daily bias analysis,  
**so that** I can get AI-powered market bias for my trading decisions.

**Acceptance Criteria (AC)** :
1. **AC1**: New "Daily Bias" page accessible from dashboard.
2. **AC2**: Page displays list of 21 pre-defined instruments (dropdown/select).
3. **AC3**: User selects instrument and clicks "Analyze".
4. **AC4**: Rate limiting : 1 request/day per user (unlimited for admins).
5. **AC5**: Display last analysis date/time if already analyzed today.

**Tech Notes** :
- Create `src/app/(dashboard)/daily-bias/page.tsx`
- Instrument list: `src/lib/instruments.ts` (21 instruments with IDs)
- DB table `DailyBiasAnalysis` (id, userId, instrumentId, date, createdAt)
- Check rate limit: `getLastAnalysisDate(userId, instrumentId)`
- Use shadcn/ui Select for instrument selection

---

### Story 12.2 : 6-Step Analysis Engine - Security Analysis

**As a** trader,  
**I want** Security analysis as part of the 6-step process,  
**so that** I understand market security context.

**Acceptance Criteria (AC)** :
1. **AC1**: Step 1 "Security" analyzes market security indicators.
2. **AC2**: AI prompt includes security checklist (volatility, risk factors, etc.).
3. **AC3**: Analysis returns structured security assessment.
4. **AC4**: Results stored in `DailyBiasAnalysis.securityAnalysis` (JSON field).

**Tech Notes** :
- Service `src/services/ai/daily-bias-service.ts`
- OpenAI GPT-4o API with structured prompt
- Prompt template includes security checklist
- Store results as JSON in Prisma (JSON field)
- ⚠️ **NOTIFICATION PM** : OpenAI GPT-4o API required

---

### Story 12.3 : 6-Step Analysis Engine - Macro Analysis

**As a** trader,  
**I want** Macro economic analysis as part of the 6-step process,  
**so that** I understand macroeconomic context.

**Acceptance Criteria (AC)** :
1. **AC1**: Step 2 "Macro" analyzes macroeconomic indicators.
2. **AC2**: Data source: ForexFactory API (or manual injection).
3. **AC3**: AI prompt includes macro checklist (GDP, inflation, rates, etc.).
4. **AC4**: Analysis returns structured macro assessment.

**Tech Notes** :
- Integrate ForexFactory API (or scraping)
- Fallback: manual data injection by user
- AI prompt includes macro checklist
- ⚠️ **NOTIFICATION PM** : ForexFactory API required (or scraping alternative)

---

### Story 12.4 : 6-Step Analysis Engine - Institutional Flux

**As a** trader,  
**I want** Institutional Flux analysis as part of the 6-step process,  
**so that** I understand institutional money flow.

**Acceptance Criteria (AC)** :
1. **AC1**: Step 3 "Institutional Flux" analyzes institutional flow.
2. **AC2**: Data source: TradingView API or Barchart (or manual injection).
3. **AC3**: AI prompt includes flux checklist (volume, large orders, etc.).
4. **AC4**: Analysis returns structured flux assessment.

**Tech Notes** :
- Integrate TradingView API or Barchart API
- Fallback: manual data injection
- AI prompt includes flux checklist
- ⚠️ **NOTIFICATION PM** : TradingView/Barchart API required

---

### Story 12.5 : 6-Step Analysis Engine - Mag 7 Leaders

**As a** trader,  
**I want** Mag 7 Leaders analysis as part of the 6-step process,  
**so that** I understand tech leaders' impact.

**Acceptance Criteria (AC)** :
1. **AC1**: Step 4 "Mag 7 Leaders" analyzes AAPL, MSFT, GOOGL, AMZN, META, NVDA, TSLA.
2. **AC2**: Data source: Market data API (Barchart, Alpha Vantage, etc.).
3. **AC3**: AI prompt includes Mag 7 checklist (performance, correlation, etc.).
4. **AC4**: Analysis returns structured Mag 7 assessment.

**Tech Notes** :
- Market data API integration (Barchart, Alpha Vantage)
- AI prompt includes Mag 7 checklist
- ⚠️ **NOTIFICATION PM** : Market data API required

---

### Story 12.6 : 6-Step Analysis Engine - Technical Structure

**As a** trader,  
**I want** Technical Structure analysis as part of the 6-step process,  
**so that** I understand technical market structure.

**Acceptance Criteria (AC)** :
1. **AC1**: Step 5 "Technical Structure" analyzes technical indicators.
2. **AC2**: Data source: TradingView API or Barchart (or manual injection).
3. **AC3**: AI prompt includes technical checklist (support/resistance, trends, etc.).
4. **AC4**: Analysis returns structured technical assessment.

**Tech Notes** :
- TradingView API or Barchart API
- Fallback: manual data injection
- AI prompt includes technical checklist
- ⚠️ **NOTIFICATION PM** : TradingView/Barchart API required

---

### Story 12.7 : 6-Step Analysis Engine - Synthesis & Final Bias

**As a** trader,  
**I want** a synthesis of all 6 steps with Final Bias and Opening Confirmation,  
**so that** I have a clear trading bias recommendation.

**Acceptance Criteria (AC)** :
1. **AC1**: Step 6 "Synthesis" combines all 5 previous analyses.
2. **AC2**: AI generates Final Bias: Bullish, Bearish, or Neutral.
3. **AC3**: AI generates Opening Confirmation (key levels/conditions to watch).
4. **AC4**: Report structured with all 6 steps + Final Bias + Opening Confirmation.
5. **AC5**: Report displayed in UI with clear formatting.

**Tech Notes** :
- AI prompt synthesizes all 6 steps
- Final Bias: enum (BULLISH, BEARISH, NEUTRAL)
- Opening Confirmation: text field
- Store complete report in `DailyBiasAnalysis` table
- UI component `src/components/daily-bias/bias-report.tsx`

---

### Story 12.8 : Real-Time Data Integration (Optional)

**As a** platform engineer,  
**I want** to integrate real-time data sources for Daily Bias analysis,  
**so that** analysis is based on current market data.

**Acceptance Criteria (AC)** :
1. **AC1**: ForexFactory data fetched (API or scraping).
2. **AC2**: TradingView data fetched (API or scraping).
3. **AC3**: Barchart data fetched (API).
4. **AC4**: Fallback: manual data injection by user if APIs unavailable.
5. **AC5**: Data cached (Redis) to avoid excessive API calls.

**Tech Notes** :
- Research ForexFactory API/scraping
- Research TradingView API/scraping
- Research Barchart API
- Fallback UI for manual data injection
- ⚠️ **NOTIFICATION PM** : All data APIs required (budget validation)

---

## Epic 13 : Benchmarks & Peer Comparison

### Story 13.1 : Benchmarks Dashboard

**As a** trader,  
**I want** to compare my performance with anonymized trader benchmarks,  
**so that** I can understand where I stand relative to peers.

**Acceptance Criteria (AC)** :
1. **AC1**: Benchmarks page displays user performance vs peers (percentiles).
2. **AC2**: Comparison metrics: win rate, profit factor, avg RR, etc.
3. **AC3**: Data anonymized (RGPD-compliant).
4. **AC4**: Matching peers similar (style, market, level) via vector search.
5. **AC5**: Performance : matching < 2s.

**Tech Notes** :
- Similar to Epic 8.2 (Collective Intelligence)
- Use vector search (Qdrant/Pinecone) for peer matching
- Anonymize data (differential privacy)
- ⚠️ **NOTIFICATION PM** : Qdrant/Pinecone API required

---

## Epic 14 : Video AI Analysis

### Story 14.1 : Video Upload & AI Analysis

**As a** trader,  
**I want** to upload trading videos and get AI analysis,  
**so that** I can receive feedback on my trading execution.

**Acceptance Criteria (AC)** :
1. **AC1**: Video upload interface (drag & drop or file picker).
2. **AC2**: Video stored in Supabase Storage or S3.
3. **AC3**: AI analyzes video (OpenAI Vision API or video analysis).
4. **AC4**: Analysis returns trading advice/feedback.
5. **AC5**: Performance : analysis < 1min for 5min video.

**Tech Notes** :
- Video upload: Supabase Storage or AWS S3
- OpenAI Vision API (if supports video) or video-to-text + GPT-4o
- ⚠️ **NOTIFICATION PM** : OpenAI Vision API or video analysis API required

---

## Epic 15 : Social Feed & Sharing

### Story 15.1 : Social Feed - Best Trades/Strategies

**As a** trader,  
**I want** to share my best trades and strategies in a social feed,  
**so that** I can learn from and inspire other traders.

**Acceptance Criteria (AC)** :
1. **AC1**: Social feed page displays shared trades/strategies.
2. **AC2**: Users can share trades/strategies (with privacy controls).
3. **AC3**: Feed supports likes, comments, follows.
4. **AC4**: Filter by instrument, strategy type, performance.
5. **AC5**: Performance : feed load < 2s.

**Tech Notes** :
- DB tables: `SocialPost`, `PostLike`, `PostComment`, `UserFollow`
- Real-time updates: Supabase Realtime or WebSockets
- Privacy controls: public/private/followers-only

---

## Epic 16 : Mobile App Companion

### Story 16.1 : Mobile App - Core Features

**As a** trader,  
**I want** a mobile app to track my trades on the go,  
**so that** I can stay connected to my trading journal.

**Acceptance Criteria (AC)** :
1. **AC1**: Mobile app (iOS + Android) with core features.
2. **AC2**: View trades, dashboard, calendar.
3. **AC3**: Add trades, notes, tags.
4. **AC4**: Sync with web app (real-time).
5. **AC5**: Push notifications for important events.

**Tech Notes** :
- React Native or Flutter
- API backend (Next.js API routes)
- Push notifications: Firebase Cloud Messaging (Android) + APNs (iOS)
- ⚠️ **NOTIFICATION PM** : Mobile app development + push notification services

---

## Epic 17 : Gamification & Challenges

### Story 17.1 : Trading Challenges System

**As a** trader,  
**I want** to participate in trading challenges with rewards,  
**so that** I can stay motivated and improve my skills.

**Acceptance Criteria (AC)** :
1. **AC1**: Challenges page displays available challenges.
2. **AC2**: Users can join challenges (time-limited).
3. **AC3**: Challenges track performance metrics (win rate, profit, etc.).
4. **AC4**: Rewards system (badges, points, leaderboard).
5. **AC5**: Leaderboard updates in real-time.

**Tech Notes** :
- DB tables: `Challenge`, `ChallengeParticipant`, `Reward`, `Badge`
- Real-time leaderboard: Supabase Realtime or WebSockets
- Reward calculation: background job (BullMQ)

---

**Document Status** : Draft - New Features Epics & Stories  
**Last Updated** : 2026-01-14  
**Next Review** : Après validation Epics
