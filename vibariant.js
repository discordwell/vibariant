import { Vibariant } from '@vibariant/sdk';
import { vibariantConfig } from './vibariant.config';

export const vibariant = new Vibariant(vibariantConfig);

vibariant.init().then(() => {
  console.log('Vibariant initialized');
});
