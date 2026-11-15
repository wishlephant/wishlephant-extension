import {amazon} from './amazon';
import {genialokal} from './genialokal';
import type {Site} from './site';

export type {Site, Sources} from './site';

export const SITES: Site[] = [amazon, genialokal];
