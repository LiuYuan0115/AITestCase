import { BuildOutput, EntrypointGroup } from '../../../types';
import type { Ora } from 'ora';
export declare function buildEntrypoints(groups: EntrypointGroup[], spinner: Ora): Promise<Omit<BuildOutput, 'manifest'>>;
