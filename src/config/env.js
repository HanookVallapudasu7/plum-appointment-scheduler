const dotenv = require('dotenv');
const { z } = require('zod');

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TIMEZONE: z.string().default('Asia/Kolkata'),
  LLM_PROVIDER: z.enum(['gemini', 'mock']).default('gemini'),
  LLM_MODEL: z.string().default('gemini-2.0-flash'),
  LLM_API_KEY: z.string().optional().default(''),
  MAX_FILE_SIZE_MB: z.coerce.number().default(5),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

module.exports = parsed.data;
