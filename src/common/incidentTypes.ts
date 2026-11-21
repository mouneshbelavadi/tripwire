/**
 * Traffic incident type mappings for SerpApi google_maps_traffic engine.
 * Maps raw provider type codes to human-readable labels, icons, and severity.
 */

export interface IncidentTypeInfo {
  code: string;
  label: string;
  category: 'closure' | 'work' | 'hazard' | 'congestion' | 'general';
  severity: 'high' | 'medium' | 'low';
  icon: string;
  description: string;
}

export const INCIDENT_DISCLAIMER =
  'Area incident, effect on individual routes is unverified';

export const INCIDENT_TYPE_MAP: Record<string, string> = {
  road_closed: 'Road closed',
  crash: 'Crash',
  congestion: 'Congestion',
  construction: 'Construction',
  accident: 'Accident',
  hazard: 'Hazard',
  lane_closed: 'Lane closed',
  waterlogging: 'Waterlogging',
  disabled_vehicle: 'Disabled vehicle',
  breakdown: 'Vehicle breakdown',
  weather: 'Weather disruption',
  special_event: 'Special event',
};

export const INCIDENT_TYPES: Record<string, IncidentTypeInfo> = {
  road_closed: {
    code: 'road_closed',
    label: 'Road closed',
    category: 'closure',
    severity: 'high',
    icon: '⛔',
    description: 'Roadway is completely or partially closed to vehicular traffic',
  },
  crash: {
    code: 'crash',
    label: 'Crash',
    category: 'hazard',
    severity: 'high',
    icon: '⚠️',
    description: 'Reported vehicular collision or incident blocking travel lanes',
  },
  construction: {
    code: 'construction',
    label: 'Construction',
    category: 'work',
    severity: 'medium',
    icon: '🚧',
    description: 'Active construction, road maintenance, or civil works',
  },
  congestion: {
    code: 'congestion',
    label: 'Congestion',
    category: 'congestion',
    severity: 'medium',
    icon: '🚗',
    description: 'Severe vehicular congestion significantly slowing corridor flow',
  },
  accident: {
    code: 'accident',
    label: 'Traffic Collision / Accident',
    category: 'hazard',
    severity: 'high',
    icon: '⚠️',
    description: 'Reported vehicular collision or incident blocking travel lanes',
  },
  disabled_vehicle: {
    code: 'disabled_vehicle',
    label: 'Stalled / Disabled Vehicle',
    category: 'hazard',
    severity: 'low',
    icon: '🚙',
    description: 'Broken down vehicle obstructing lane or shoulder',
  },
  weather: {
    code: 'weather',
    label: 'Adverse Weather / Waterlogging',
    category: 'hazard',
    severity: 'high',
    icon: '🌧️',
    description: 'Heavy rain, flooding, waterlogging, or reduced visibility',
  },
  hazard: {
    code: 'hazard',
    label: 'Road Hazard',
    category: 'hazard',
    severity: 'medium',
    icon: '⚠️',
    description: 'Debris, fallen branches, or road surface danger',
  },
  lane_closed: {
    code: 'lane_closed',
    label: 'Lane closed',
    category: 'work',
    severity: 'medium',
    icon: '🛑',
    description: 'One or more travel lanes restricted',
  },
  waterlogging: {
    code: 'waterlogging',
    label: 'Waterlogging',
    category: 'hazard',
    severity: 'high',
    icon: '🌧️',
    description: 'Road waterlogging',
  },
  special_event: {
    code: 'special_event',
    label: 'Special Event / Procession',
    category: 'general',
    severity: 'low',
    icon: '🎪',
    description: 'Event or gathering affecting area vehicular access',
  },
};



/**
 * Returns human-readable label for a raw SerpApi traffic incident type.
 */
export function getHumanReadableIncidentType(rawType: string): string {
  if (!rawType) return 'Traffic Incident';
  const normalized = rawType.toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (INCIDENT_TYPES[normalized]) {
    return INCIDENT_TYPES[normalized].label;
  }
  // Title-case fallback for unrecognized types
  return rawType
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function humanizeIncidentType(rawType: string): string {
  return getHumanReadableIncidentType(rawType);
}
export function getIncidentTypeDetails(rawType: string): IncidentTypeInfo {
  if (!rawType) {
    return {
      code: 'unknown',
      label: 'Traffic Incident',
      category: 'general',
      severity: 'medium',
      icon: '⚠️',
      description: 'Unspecified traffic incident detected in area',
    };
  }
  const normalized = rawType.toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (INCIDENT_TYPES[normalized]) {
    return INCIDENT_TYPES[normalized];
  }
  return {
    code: normalized,
    label: getHumanReadableIncidentType(rawType),
    category: 'general',
    severity: 'medium',
    icon: '⚠️',
    description: `Reported ${rawType.replace(/[_-]/g, ' ')} incident in monitored area`,
  };
}
