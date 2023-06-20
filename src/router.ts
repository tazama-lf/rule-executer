import Router from 'koa-router';
import { execute } from './controllers/execute';
import { healthCheck } from './controllers/healthCheck';

const router = new Router();

// health checks
router.get('/', healthCheck);
router.get('/health', healthCheck);
router.post('/execute', execute);

export default router;
