import rateLimiter from '@convex-dev/rate-limiter/convex.config';
import workpool from '@convex-dev/workpool/convex.config';
import { defineComponent } from 'convex/server';

const component = defineComponent('postshiba');

component.use(rateLimiter);

component.use(workpool, { name: 'transactionalPool' });
component.use(workpool, { name: 'bulkPool' });
component.use(workpool, { name: 'callbackPool' });

export default component;
