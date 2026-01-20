import fs from 'fs';
import path from 'path';

export interface RoadmapItem {
  id: string; // Unique identifier: "Epic 10" or "Phase 10"
  type: 'epic' | 'phase';
  title: string;
  status: 'upcoming' | 'completed' | 'in_progress';
  priority: 'critique' | 'haute' | 'moyenne' | 'basse' | null;
  phase?: string; // Phase name if this is an epic
  epic?: string; // Epic number if this is an epic
  description?: string;
  dependances?: string;
  delivrables?: string[];
}

export interface RoadmapSection {
  phaseNumber: string; // "Phase 1", "Phase 10", etc.
  phaseTitle: string;
  phasePriority: 'critique' | 'haute' | 'moyenne' | 'basse' | null;
  phaseStatus: 'upcoming' | 'completed' | 'in_progress';
  epics: RoadmapItem[];
}

/**
 * Extract status from text (handles multiple formats)
 * IMPORTANT: Must not confuse priority emojis (🟢 BASSE) with status emojis (🟢 Completed)
 */
function extractStatus(text: string): 'upcoming' | 'completed' | 'in_progress' {
  // Check for explicit status patterns FIRST (most reliable)
  // Look for "**Status**" or "- **Status**" followed by emoji or text
  const statusPattern = /\*\*Status\*\*\s*:\s*([🟠🟢🔵]|Upcoming|Completed|In Progress|Backlog|Planning)/i;
  const statusMatch = text.match(statusPattern);
  if (statusMatch) {
    const statusIndicator = statusMatch[1];
    if (statusIndicator === '🟠' || /upcoming|backlog|planning/i.test(statusIndicator)) return 'upcoming';
    if (statusIndicator === '🟢' || /completed|complété/i.test(statusIndicator)) return 'completed';
    if (statusIndicator === '🔵' || /in progress|en cours/i.test(statusIndicator)) return 'in_progress';
  }

  // Only check standalone emojis if NOT in a priority context
  // Avoid matching priority emojis like "🟢 BASSE" or "🟢 MOYENNE-BASSE"
  const hasPriorityContext = /\*\*Priorité\*\*\s*:\s*[🟠🟢🔡]|Priority|Priorité/i.test(text);
  
  if (!hasPriorityContext) {
    // Check for emojis in status context (but not priority)
    if (text.includes('🟠') && !/\*\*Priorité\*\*.*🟠/.test(text)) return 'upcoming';
    if (text.includes('🔵')) return 'in_progress';
    // Only use 🟢 for completed if it's clearly not a priority indicator
    if (text.includes('🟢') && !/\*\*Priorité\*\*.*🟢.*(BASSE|MOYENNE|HAUTE|CRITIQUE)/i.test(text)) {
      // Double-check: if 🟢 appears near "Priorité", it's probably priority
      const priorityIndex = text.indexOf('**Priorité**');
      const greenIndex = text.indexOf('🟢');
      if (priorityIndex === -1 || (greenIndex !== -1 && Math.abs(greenIndex - priorityIndex) > 50)) {
        return 'completed';
      }
    }
  }
  
  // Check for status text (after priority check)
  const lowerText = text.toLowerCase();
  if ((lowerText.includes('completed') || lowerText.includes('complété')) && !hasPriorityContext) {
    return 'completed';
  }
  if (lowerText.includes('in progress') || lowerText.includes('en cours')) return 'in_progress';
  if (lowerText.includes('planning') || lowerText.includes('backlog')) return 'upcoming';
  
  // Default to upcoming
  return 'upcoming';
}

/**
 * Extract priority from text
 */
function extractPriority(text: string): 'critique' | 'haute' | 'moyenne' | 'basse' | null {
  // Check for priority emojis
  if (text.includes('🔴') || text.includes('CRITIQUE')) return 'critique';
  if (text.includes('🟠') && text.includes('HAUTE')) return 'haute';
  if (text.includes('🟡') || text.includes('MOYENNE')) return 'moyenne';
  if (text.includes('🟢') && text.includes('BASSE')) return 'basse';
  
  // Check for priority text
  const lowerText = text.toLowerCase();
  if (lowerText.includes('critique')) return 'critique';
  if (lowerText.includes('haute')) return 'haute';
  if (lowerText.includes('moyenne')) return 'moyenne';
  if (lowerText.includes('basse')) return 'basse';
  
  return null;
}

/**
 * Parse PROJECT_MEMORY.md to extract phase/epic status overrides
 */
function parseProjectMemoryStatuses(): Map<string, 'upcoming' | 'completed' | 'in_progress'> {
  const statusMap = new Map<string, 'upcoming' | 'completed' | 'in_progress'>();
  
  try {
    const projectMemoryPath = path.join(process.cwd(), 'PROJECT_MEMORY.md');
    if (!fs.existsSync(projectMemoryPath)) {
      return statusMap;
    }

    const memoryContent = fs.readFileSync(projectMemoryPath, 'utf-8');
    
    // Look for patterns like:
    // - "Epic 10 complété" or "Epic 10 completed"
    // - "Phase 10 complétée" or "Phase 10 completed"
    // - "Epic 10 complété avec X stories"
    // - Entry titles mentioning epic/phase completion
    
    // Pattern 1: Direct mentions "Epic X complété/completed" or "Phase X complétée/completed"
    // Match: "Epic 10 complété" or "Epic 10 completed" or "Epic 10 complété avec"
    const completedPattern = /(Epic|Phase)\s+(\d+)\s+(complété|completed|complétée)(\s|$|[^\n]*)/gi;
    const completedMatches = [...memoryContent.matchAll(completedPattern)];
    for (const match of completedMatches) {
      const itemType = match[1];
      const itemNumber = match[2];
      const itemId = `${itemType} ${itemNumber}`;
      statusMap.set(itemId, 'completed');
    }

    // Pattern 2: Entry headers mentioning epic/phase completion
    // Match: "## [date] - Epic 10: ..." or "- Epic 10 complété"
    const entryCompletedPattern = /(?:##|###|\*\*|\-)\s*.*?(Epic|Phase)\s+(\d+)[^\n]*(?:complété|completed|complétée)/gi;
    const entryMatches = [...memoryContent.matchAll(entryCompletedPattern)];
    for (const match of entryMatches) {
      const itemType = match[1];
      const itemNumber = match[2];
      const itemId = `${itemType} ${itemNumber}`;
      statusMap.set(itemId, 'completed');
    }

    // Pattern 3: Look for "Epic X" or "Phase X" in recent entries (might be in_progress)
    // This is less reliable, so we'll use explicit "in progress" mentions only
    const inProgressPattern = /(Epic|Phase)\s+(\d+)[^\n]*(?:in progress|en cours)/gi;
    const inProgressMatches = [...memoryContent.matchAll(inProgressPattern)];
    for (const match of inProgressMatches) {
      const itemType = match[1];
      const itemNumber = match[2];
      const itemId = `${itemType} ${itemNumber}`;
      // Only override if not already marked as completed
      if (!statusMap.has(itemId)) {
        statusMap.set(itemId, 'in_progress');
      }
    }
    
    return statusMap;
  } catch (error) {
    console.warn('Could not parse PROJECT_MEMORY.md for statuses:', error);
    return statusMap;
  }
}

/**
 * Parse roadmap markdown files and extract phases/epics with their statuses
 */
export function parseRoadmapMarkdown(): {
  sections: RoadmapSection[];
  allItems: RoadmapItem[];
} {
  try {
    // #region agent log
    console.log('[DEBUG roadmap-parser.ts:163] parseRoadmapMarkdown called', { timestamp: Date.now(), hypothesisId: 'H4' });
    // #endregion
    // Parse PROJECT_MEMORY.md first to get status overrides
    const projectMemoryStatuses = parseProjectMemoryStatuses();
    // #region agent log
    console.log('[DEBUG roadmap-parser.ts:168] After parseProjectMemoryStatuses', { statusMapSize: projectMemoryStatuses.size, timestamp: Date.now(), hypothesisId: 'H4' });
    // #endregion

    const roadmapPath = path.join(process.cwd(), 'docs', 'roadmap-trading-path-journal.md');
    const newFeaturesPath = path.join(process.cwd(), 'docs', 'roadmap-trading-path-journal-NEW-FEATURES.md');

    let roadmapContent = '';
    let newFeaturesContent = '';

    // Read files (with error handling for serverless environments)
    try {
      if (fs.existsSync(roadmapPath)) {
        roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
      }
    } catch (error) {
      console.warn('Could not read roadmap file:', error);
    }

    try {
      if (fs.existsSync(newFeaturesPath)) {
        newFeaturesContent = fs.readFileSync(newFeaturesPath, 'utf-8');
      }
    } catch (error) {
      console.warn('Could not read new features roadmap file:', error);
    }

    const allContent = `${roadmapContent}\n\n${newFeaturesContent}`;

    if (!allContent.trim()) {
      console.warn('No roadmap content found');
      return { sections: [], allItems: [] };
    }

    const sections: RoadmapSection[] = [];
    const allItems: RoadmapItem[] = [];

    // Regex patterns - more flexible
    const phasePattern = /^### Phase (\d+) : (.+)$/gm;
    const epicPattern = /^- Epic (\d+) : (.+)$/gm;
    const epicSectionPattern = /^### Epic (\d+) : (.+)$/gm;

    // Parse phases
    const phaseMatches = [...allContent.matchAll(phasePattern)];
    const epicSectionMatches = [...allContent.matchAll(epicSectionPattern)];

    // Also extract epics from epic sections (section 4 of roadmap)
    const epicDetailsMap = new Map<string, { status: 'upcoming' | 'completed' | 'in_progress'; priority: 'critique' | 'haute' | 'moyenne' | 'basse' | null }>();

    for (const epicSectionMatch of epicSectionMatches) {
      const epicNumber = epicSectionMatch[1];
      const epicTitle = epicSectionMatch[2].trim();
      const epicId = `Epic ${epicNumber}`;

      // Get content between this epic section and next (or end)
      const epicStartIndex = epicSectionMatch.index!;
      const nextEpicIndex = epicSectionMatches[epicSectionMatches.indexOf(epicSectionMatch) + 1]?.index ?? allContent.length;
      const epicContent = allContent.substring(epicStartIndex, nextEpicIndex);

      const status = extractStatus(epicContent);
      const priority = extractPriority(epicContent);

      epicDetailsMap.set(epicId, { status, priority });
    }

    for (let i = 0; i < phaseMatches.length; i++) {
      const phaseMatch = phaseMatches[i];
      const phaseNumber = phaseMatch[1];
      const phaseTitle = phaseMatch[2].trim();

      // Get content between this phase and next phase (or end)
      const phaseStartIndex = phaseMatch.index!;
      const phaseEndIndex = i < phaseMatches.length - 1 ? phaseMatches[i + 1].index! : allContent.length;
      const phaseContent = allContent.substring(phaseStartIndex, phaseEndIndex);

      // Extract phase status and priority
      // Check PROJECT_MEMORY.md first, then fall back to markdown parsing
      const phaseId = `Phase ${phaseNumber}`;
      const phaseStatusFromMemory = projectMemoryStatuses.get(phaseId);
      const phaseStatus = phaseStatusFromMemory || extractStatus(phaseContent);
      const phasePriority = extractPriority(phaseContent);

      // Extract epics in this phase
      const epicMatches = [...phaseContent.matchAll(epicPattern)];
      const epics: RoadmapItem[] = [];

      for (const epicMatch of epicMatches) {
        const epicNumber = epicMatch[1];
        const epicTitle = epicMatch[2].trim();
        const epicId = `Epic ${epicNumber}`;

        // Get content for this epic
        const epicStartIndex = phaseContent.indexOf(epicMatch[0]);
        const nextEpicMatch = epicMatches[epicMatches.indexOf(epicMatch) + 1];
        const epicEndIndex = nextEpicMatch ? phaseContent.indexOf(nextEpicMatch[0]) : phaseContent.length;
        const epicContent = phaseContent.substring(epicStartIndex, epicEndIndex);

        // Get status and priority from epic details map if available, otherwise from epic content or phase
        // Check PROJECT_MEMORY.md first, then fall back to other sources
        const epicStatusFromMemory = projectMemoryStatuses.get(epicId);
        const epicDetails = epicDetailsMap.get(epicId);
        const epicStatus = epicStatusFromMemory || epicDetails?.status || extractStatus(epicContent) || phaseStatus;
        const epicPriority = epicDetails?.priority || extractPriority(epicContent) || phasePriority;

        // Extract description (first paragraph after epic line, up to next markdown element)
        const descriptionMatch = epicContent.match(/\n\n(.+?)(?:\n\n|\*\*|\n###|\n-)/s);
        const description = descriptionMatch ? descriptionMatch[1].trim().replace(/\*\*/g, '').substring(0, 200) : undefined;

        const epicItem: RoadmapItem = {
          id: epicId,
          type: 'epic',
          title: epicTitle,
          status: epicStatus,
          priority: epicPriority,
          phase: `Phase ${phaseNumber}`,
          epic: `Epic ${epicNumber}`,
          description,
        };

        epics.push(epicItem);
        allItems.push(epicItem);
      }

      // Create phase item
      const phaseItem: RoadmapItem = {
        id: `Phase ${phaseNumber}`,
        type: 'phase',
        title: phaseTitle,
        status: phaseStatus,
        priority: phasePriority,
      };

      const currentPhase: RoadmapSection = {
        phaseNumber: `Phase ${phaseNumber}`,
        phaseTitle,
        phasePriority,
        phaseStatus,
        epics,
      };

      sections.push(currentPhase);
      allItems.push(phaseItem);
    }

    // Sort sections by phase number
    sections.sort((a, b) => {
      const numA = parseInt(a.phaseNumber.match(/\d+/)?.[0] || '999');
      const numB = parseInt(b.phaseNumber.match(/\d+/)?.[0] || '999');
      return numA - numB;
    });

    // Sort epics within sections
    sections.forEach(section => {
      section.epics.sort((a, b) => {
        const numA = parseInt(a.epic?.match(/\d+/)?.[0] || '999');
        const numB = parseInt(b.epic?.match(/\d+/)?.[0] || '999');
        return numA - numB;
      });
    });

    // Log status overrides from PROJECT_MEMORY.md (debug)
    if (projectMemoryStatuses.size > 0) {
      console.log('[Roadmap Parser] Status overrides from PROJECT_MEMORY.md:', Array.from(projectMemoryStatuses.entries()));
    }

    return { sections, allItems };
  } catch (error) {
    console.error('Error parsing roadmap markdown:', error);
    return { sections: [], allItems: [] };
  }
}
