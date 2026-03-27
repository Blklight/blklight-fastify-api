import { db } from './index';
import { categories } from '../features/categories/categories.schema';
import { tags as tagsTable } from '../features/tags/tags.schema';
import { createId } from '@paralleldrive/cuid2';
import { env } from '../config/env';
import { eq } from 'drizzle-orm';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

interface CategoryInput {
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
}

interface TagInput {
  name: string;
  slug: string;
}

const categoryData: CategoryInput[] = [
  // Technology (root)
  { name: 'Technology', slug: 'technology', description: 'All things tech' },
  // Technology subcategories
  { name: 'Web Development', slug: 'web-development', parentId: '' },
  { name: 'Mobile', slug: 'mobile', parentId: '' },
  { name: 'Artificial Intelligence & ML', slug: 'ai-ml', parentId: '' },
  { name: 'DevOps & Cloud', slug: 'devops-cloud', parentId: '' },
  { name: 'Security & Cybersecurity', slug: 'security-cybersecurity', parentId: '' },
  { name: 'Data Science & Analytics', slug: 'data-science-analytics', parentId: '' },
  { name: 'Games & Game Development', slug: 'games-game-development', parentId: '' },
  { name: 'Blockchain & Web3', slug: 'blockchain-web3', parentId: '' },
  { name: 'Embedded Systems & IoT', slug: 'embedded-systems-iot', parentId: '' },
  { name: 'Software Architecture', slug: 'software-architecture', parentId: '' },
  { name: 'Open Source', slug: 'open-source', parentId: '' },
  { name: 'Hardware & Electronics', slug: 'hardware-electronics', parentId: '' },

  // Science (root)
  { name: 'Science', slug: 'science', description: 'Scientific exploration and discovery' },
  // Science subcategories
  { name: 'Physics', slug: 'physics', parentId: '' },
  { name: 'Chemistry', slug: 'chemistry', parentId: '' },
  { name: 'Biology & Genetics', slug: 'biology-genetics', parentId: '' },
  { name: 'Astronomy & Astrophysics', slug: 'astronomy-astrophysics', parentId: '' },
  { name: 'Mathematics', slug: 'mathematics', parentId: '' },
  { name: 'Neuroscience', slug: 'neuroscience', parentId: '' },
  { name: 'Environmental Science', slug: 'environmental-science', parentId: '' },
  { name: 'Materials Science', slug: 'materials-science', parentId: '' },

  // Art & Design (root)
  { name: 'Art & Design', slug: 'art-design', description: 'Creative and visual arts' },
  // Art & Design subcategories
  { name: 'Graphic Design', slug: 'graphic-design', parentId: '' },
  { name: 'Digital Illustration', slug: 'digital-illustration', parentId: '' },
  { name: 'Photography', slug: 'photography', parentId: '' },
  { name: 'UI/UX Design', slug: 'ui-ux-design', parentId: '' },
  { name: 'Motion & Video', slug: 'motion-video', parentId: '' },
  { name: 'Architecture & Urban Planning', slug: 'architecture-urban-planning', parentId: '' },
  { name: 'Fashion & Style', slug: 'fashion-style', parentId: '' },
  { name: 'Generative Art & NFT', slug: 'generative-art-nft', parentId: '' },

  // Business (root)
  { name: 'Business', slug: 'business', description: 'Business, entrepreneurship, and finance' },
  // Business subcategories
  { name: 'Entrepreneurship', slug: 'entrepreneurship', parentId: '' },
  { name: 'Marketing & Growth', slug: 'marketing-growth', parentId: '' },
  { name: 'Finance & Investments', slug: 'finance-investments', parentId: '' },
  { name: 'Management & Leadership', slug: 'management-leadership', parentId: '' },
  { name: 'Product & UX Research', slug: 'product-ux-research', parentId: '' },
  { name: 'Sales & CRM', slug: 'sales-crm', parentId: '' },
  { name: 'Startups & Innovation', slug: 'startups-innovation', parentId: '' },

  // Health (root)
  { name: 'Health', slug: 'health', description: 'Health, wellness, and medicine' },
  // Health subcategories
  { name: 'Mental Health', slug: 'mental-health', parentId: '' },
  { name: 'Nutrition & Food', slug: 'nutrition-food', parentId: '' },
  { name: 'Fitness & Sports', slug: 'fitness-sports', parentId: '' },
  { name: 'Medicine & Diagnosis', slug: 'medicine-diagnosis', parentId: '' },
  { name: 'Wellness & Mindfulness', slug: 'wellness-mindfulness', parentId: '' },
  { name: 'Digital Health', slug: 'digital-health', parentId: '' },

  // Education (root)
  { name: 'Education', slug: 'education', description: 'Teaching, learning, and development' },
  // Education subcategories
  { name: 'Teaching Methodologies', slug: 'teaching-methodologies', parentId: '' },
  { name: 'Educational Technology', slug: 'educational-technology', parentId: '' },
  { name: 'Career & Development', slug: 'career-development', parentId: '' },
  { name: 'Languages', slug: 'languages', parentId: '' },
  { name: 'Early Childhood Education', slug: 'early-childhood-education', parentId: '' },
  { name: 'Higher Education', slug: 'higher-education', parentId: '' },

  // Humanities (root)
  { name: 'Humanities', slug: 'humanities', description: 'Human society, culture, and thought' },
  // Humanities subcategories
  { name: 'History', slug: 'history', parentId: '' },
  { name: 'Philosophy', slug: 'philosophy', parentId: '' },
  { name: 'Literature & Writing', slug: 'literature-writing', parentId: '' },
  { name: 'Sociology & Politics', slug: 'sociology-politics', parentId: '' },
  { name: 'Psychology', slug: 'psychology', parentId: '' },
  { name: 'Anthropology', slug: 'anthropology', parentId: '' },
  { name: 'Law & Justice', slug: 'law-justice', parentId: '' },
  { name: 'Economics & Society', slug: 'economics-society', parentId: '' },

  // Entertainment (root)
  { name: 'Entertainment', slug: 'entertainment', description: 'Movies, music, games, and more' },
  // Entertainment subcategories
  { name: 'Anime', slug: 'anime', parentId: '' },
  { name: 'Manga', slug: 'manga', parentId: '' },
  { name: 'Movies & TV Shows', slug: 'movies-tv-shows', parentId: '' },
  { name: 'Music & Audio', slug: 'music-audio', parentId: '' },
  { name: 'Comics & Graphic Novels', slug: 'comics-graphic-novels', parentId: '' },
  { name: 'Gaming & eSports', slug: 'gaming-esports', parentId: '' },
  { name: 'Podcasts', slug: 'podcasts', parentId: '' },
  { name: 'Books & Reading', slug: 'books-reading', parentId: '' },

  // Food & Gastronomy (root)
  { name: 'Food & Gastronomy', slug: 'food-gastronomy', description: 'Cooking, recipes, and culinary arts' },
  // Food & Gastronomy subcategories
  { name: 'Recipes', slug: 'recipes', parentId: '' },
  { name: 'International Cuisine', slug: 'international-cuisine', parentId: '' },
  { name: 'Drinks & Mixology', slug: 'drinks-mixology', parentId: '' },
  { name: 'Food Culture', slug: 'food-culture', parentId: '' },

  // Travel & Culture (root)
  { name: 'Travel & Culture', slug: 'travel-culture', description: 'Travel, culture, and lifestyle' },
  // Travel & Culture subcategories
  { name: 'Destinations', slug: 'destinations', parentId: '' },
  { name: 'Local Culture', slug: 'local-culture', parentId: '' },
  { name: 'Travel Tips', slug: 'travel-tips', parentId: '' },
  { name: 'Digital Nomadism', slug: 'digital-nomadism', parentId: '' },

  // Sustainability (root)
  { name: 'Sustainability', slug: 'sustainability', description: 'Environment and sustainable living' },
  // Sustainability subcategories
  { name: 'Environment', slug: 'environment', parentId: '' },
  { name: 'Renewable Energy', slug: 'renewable-energy', parentId: '' },
  { name: 'Recycling & Conscious Consumption', slug: 'recycling-conscious-consumption', parentId: '' },
  { name: 'Biodiversity', slug: 'biodiversity', parentId: '' },
  { name: 'Agriculture & Permaculture', slug: 'agriculture-permaculture', parentId: '' },

  // Adult (root)
  { name: 'Adult', slug: 'adult', description: 'Adult content and fiction' },
  // Adult subcategories
  { name: 'Adult Fiction', slug: 'adult-fiction', parentId: '' },
  { name: 'Adult Content', slug: 'adult-content', parentId: '' },
];

const tagData: TagInput[] = [
  // Programming
  { name: 'javascript', slug: 'javascript' },
  { name: 'typescript', slug: 'typescript' },
  { name: 'python', slug: 'python' },
  { name: 'rust', slug: 'rust' },
  { name: 'golang', slug: 'golang' },
  { name: 'java', slug: 'java' },
  { name: 'kotlin', slug: 'kotlin' },
  { name: 'swift', slug: 'swift' },
  { name: 'cpp', slug: 'cpp' },
  { name: 'ruby', slug: 'ruby' },
  { name: 'php', slug: 'php' },
  { name: 'elixir', slug: 'elixir' },
  { name: 'scala', slug: 'scala' },
  { name: 'react', slug: 'react' },
  { name: 'vue', slug: 'vue' },
  { name: 'angular', slug: 'angular' },
  { name: 'svelte', slug: 'svelte' },
  { name: 'nextjs', slug: 'nextjs' },
  { name: 'nodejs', slug: 'nodejs' },
  { name: 'fastify', slug: 'fastify' },
  { name: 'express', slug: 'express' },
  { name: 'django', slug: 'django' },
  { name: 'rails', slug: 'rails' },
  { name: 'laravel', slug: 'laravel' },
  { name: 'spring', slug: 'spring' },
  { name: 'nestjs', slug: 'nestjs' },
  { name: 'graphql', slug: 'graphql' },
  { name: 'rest', slug: 'rest' },
  { name: 'grpc', slug: 'grpc' },
  { name: 'websocket', slug: 'websocket' },
  { name: 'api', slug: 'api' },
  { name: 'functional-programming', slug: 'functional-programming' },
  { name: 'object-oriented', slug: 'object-oriented' },
  { name: 'design-patterns', slug: 'design-patterns' },
  { name: 'clean-code', slug: 'clean-code' },
  { name: 'refactoring', slug: 'refactoring' },
  { name: 'testing', slug: 'testing' },
  { name: 'tdd', slug: 'tdd' },
  { name: 'ddd', slug: 'ddd' },
  { name: 'solid', slug: 'solid' },
  { name: 'dry', slug: 'dry' },

  // Infrastructure
  { name: 'docker', slug: 'docker' },
  { name: 'kubernetes', slug: 'kubernetes' },
  { name: 'terraform', slug: 'terraform' },
  { name: 'aws', slug: 'aws' },
  { name: 'gcp', slug: 'gcp' },
  { name: 'azure', slug: 'azure' },
  { name: 'linux', slug: 'linux' },
  { name: 'nginx', slug: 'nginx' },
  { name: 'postgresql', slug: 'postgresql' },
  { name: 'mysql', slug: 'mysql' },
  { name: 'mongodb', slug: 'mongodb' },
  { name: 'redis', slug: 'redis' },
  { name: 'elasticsearch', slug: 'elasticsearch' },
  { name: 'kafka', slug: 'kafka' },
  { name: 'rabbitmq', slug: 'rabbitmq' },
  { name: 'git', slug: 'git' },
  { name: 'github', slug: 'github' },
  { name: 'ci-cd', slug: 'ci-cd' },
  { name: 'devops', slug: 'devops' },
  { name: 'cloud', slug: 'cloud' },
  { name: 'serverless', slug: 'serverless' },
  { name: 'microservices', slug: 'microservices' },
  { name: 'monorepo', slug: 'monorepo' },
  { name: 'vps', slug: 'vps' },
  { name: 'reverse-proxy', slug: 'reverse-proxy' },
  { name: 'load-balancer', slug: 'load-balancer' },
  { name: 'infrastructure-as-code', slug: 'infrastructure-as-code' },
  { name: 'observability', slug: 'observability' },
  { name: 'monitoring', slug: 'monitoring' },
  { name: 'logging', slug: 'logging' },
  { name: 'tracing', slug: 'tracing' },
  { name: 'security', slug: 'security' },
  { name: 'ssl', slug: 'ssl' },
  { name: 'dns', slug: 'dns' },
  { name: 'cdn', slug: 'cdn' },
  { name: 'edge-computing', slug: 'edge-computing' },

  // AI & Data
  { name: 'machine-learning', slug: 'machine-learning' },
  { name: 'deep-learning', slug: 'deep-learning' },
  { name: 'nlp', slug: 'nlp' },
  { name: 'computer-vision', slug: 'computer-vision' },
  { name: 'tensorflow', slug: 'tensorflow' },
  { name: 'pytorch', slug: 'pytorch' },
  { name: 'pandas', slug: 'pandas' },
  { name: 'numpy', slug: 'numpy' },
  { name: 'jupyter', slug: 'jupyter' },
  { name: 'llm', slug: 'llm' },
  { name: 'gpt', slug: 'gpt' },
  { name: 'data-engineering', slug: 'data-engineering' },
  { name: 'etl', slug: 'etl' },
  { name: 'bi', slug: 'bi' },
  { name: 'tableau', slug: 'tableau' },
  { name: 'spark', slug: 'spark' },
  { name: 'hugging-face', slug: 'hugging-face' },
  { name: 'fine-tuning', slug: 'fine-tuning' },
  { name: 'prompt-engineering', slug: 'prompt-engineering' },
  { name: 'rag', slug: 'rag' },
  { name: 'embeddings', slug: 'embeddings' },
  { name: 'neural-networks', slug: 'neural-networks' },
  { name: 'reinforcement-learning', slug: 'reinforcement-learning' },
  { name: 'generative-ai', slug: 'generative-ai' },
  { name: 'stable-diffusion', slug: 'stable-diffusion' },
  { name: 'data-visualization', slug: 'data-visualization' },
  { name: 'statistics', slug: 'statistics' },
  { name: 'r-language', slug: 'r-language' },
  { name: 'feature-engineering', slug: 'feature-engineering' },
  { name: 'model-deployment', slug: 'model-deployment' },
  { name: 'mlops', slug: 'mlops' },
  { name: 'vector-database', slug: 'vector-database' },

  // Design
  { name: 'figma', slug: 'figma' },
  { name: 'sketch', slug: 'sketch' },
  { name: 'adobe', slug: 'adobe' },
  { name: 'css', slug: 'css' },
  { name: 'tailwind', slug: 'tailwind' },
  { name: 'animation', slug: 'animation' },
  { name: 'typography', slug: 'typography' },
  { name: 'branding', slug: 'branding' },
  { name: 'wireframe', slug: 'wireframe' },
  { name: 'prototyping', slug: 'prototyping' },
  { name: 'accessibility', slug: 'accessibility' },
  { name: 'color-theory', slug: 'color-theory' },
  { name: 'illustration', slug: 'illustration' },
  { name: 'svg', slug: 'svg' },
  { name: 'webgl', slug: 'webgl' },
  { name: 'design-system', slug: 'design-system' },
  { name: 'dark-mode', slug: 'dark-mode' },
  { name: 'responsive-design', slug: 'responsive-design' },
  { name: 'motion-design', slug: 'motion-design' },
  { name: 'ux-research', slug: 'ux-research' },
  { name: 'user-testing', slug: 'user-testing' },
  { name: 'information-architecture', slug: 'information-architecture' },
  { name: 'interaction-design', slug: 'interaction-design' },
  { name: 'visual-design', slug: 'visual-design' },
  { name: 'design-tokens', slug: 'design-tokens' },
  { name: 'component-library', slug: 'component-library' },
  { name: 'storybook', slug: 'storybook' },

  // Business
  { name: 'startup', slug: 'startup' },
  { name: 'product-management', slug: 'product-management' },
  { name: 'agile', slug: 'agile' },
  { name: 'scrum', slug: 'scrum' },
  { name: 'okr', slug: 'okr' },
  { name: 'growth-hacking', slug: 'growth-hacking' },
  { name: 'seo', slug: 'seo' },
  { name: 'social-media', slug: 'social-media' },
  { name: 'copywriting', slug: 'copywriting' },
  { name: 'b2b', slug: 'b2b' },
  { name: 'b2c', slug: 'b2c' },
  { name: 'saas', slug: 'saas' },
  { name: 'fundraising', slug: 'fundraising' },
  { name: 'pitch', slug: 'pitch' },
  { name: 'lean', slug: 'lean' },
  { name: 'digital-marketing', slug: 'digital-marketing' },
  { name: 'user-research', slug: 'user-research' },
  { name: 'persona', slug: 'persona' },
  { name: 'mvp', slug: 'mvp' },
  { name: 'product-led-growth', slug: 'product-led-growth' },
  { name: 'go-to-market', slug: 'go-to-market' },
  { name: 'customer-success', slug: 'customer-success' },
  { name: 'churn', slug: 'churn' },
  { name: 'retention', slug: 'retention' },
  { name: 'conversion', slug: 'conversion' },
  { name: 'a-b-testing', slug: 'a-b-testing' },
  { name: 'analytics', slug: 'analytics' },
  { name: 'pricing', slug: 'pricing' },
  { name: 'monetization', slug: 'monetization' },
  { name: 'business-model', slug: 'business-model' },
  { name: 'venture-capital', slug: 'venture-capital' },

  // Content
  { name: 'tutorial', slug: 'tutorial' },
  { name: 'guide', slug: 'guide' },
  { name: 'article', slug: 'article' },
  { name: 'opinion', slug: 'opinion' },
  { name: 'review', slug: 'review' },
  { name: 'analysis', slug: 'analysis' },
  { name: 'case-study', slug: 'case-study' },
  { name: 'project', slug: 'project' },
  { name: 'experiment', slug: 'experiment' },
  { name: 'research', slug: 'research' },
  { name: 'essay', slug: 'essay' },
  { name: 'reference', slug: 'reference' },
  { name: 'checklist', slug: 'checklist' },
  { name: 'roadmap', slug: 'roadmap' },
  { name: 'glossary', slug: 'glossary' },
  { name: 'interview', slug: 'interview' },
  { name: 'comparison', slug: 'comparison' },
  { name: 'hands-on', slug: 'hands-on' },
  { name: 'deep-dive', slug: 'deep-dive' },
  { name: 'summary', slug: 'summary' },
  { name: 'breakdown', slug: 'breakdown' },
  { name: 'newsletter', slug: 'newsletter' },
  { name: 'thread', slug: 'thread' },
  { name: 'listicle', slug: 'listicle' },
  { name: 'walkthrough', slug: 'walkthrough' },
  { name: 'explanation', slug: 'explanation' },

  // Level
  { name: 'beginner', slug: 'beginner' },
  { name: 'intermediate', slug: 'intermediate' },
  { name: 'advanced', slug: 'advanced' },
  { name: 'expert', slug: 'expert' },

  // Format
  { name: 'long-read', slug: 'long-read' },
  { name: 'series', slug: 'series' },
  { name: 'documentation', slug: 'documentation' },
  { name: 'open-source', slug: 'open-source' },
  { name: 'contribution', slug: 'contribution' },
  { name: 'community', slug: 'community' },
  { name: 'event', slug: 'event' },
  { name: 'conference', slug: 'conference' },
  { name: 'hackathon', slug: 'hackathon' },
  { name: 'mentorship', slug: 'mentorship' },
  { name: 'career', slug: 'career' },
  { name: 'tips', slug: 'tips' },
  { name: 'productivity', slug: 'productivity' },
  { name: 'tools', slug: 'tools' },
  { name: 'resources', slug: 'resources' },
  { name: 'weekly', slug: 'weekly' },
  { name: 'monthly', slug: 'monthly' },
  { name: 'roundup', slug: 'roundup' },

  // Health & Wellness
  { name: 'meditation', slug: 'meditation' },
  { name: 'yoga', slug: 'yoga' },
  { name: 'therapy', slug: 'therapy' },
  { name: 'anxiety', slug: 'anxiety' },
  { name: 'depression', slug: 'depression' },
  { name: 'self-care', slug: 'self-care' },
  { name: 'sleep', slug: 'sleep' },
  { name: 'breathing', slug: 'breathing' },
  { name: 'mindfulness', slug: 'mindfulness' },
  { name: 'positive-psychology', slug: 'positive-psychology' },
  { name: 'coaching', slug: 'coaching' },
  { name: 'burnout', slug: 'burnout' },
  { name: 'remote-work', slug: 'remote-work' },
  { name: 'mental-health', slug: 'mental-health' },
  { name: 'wellness', slug: 'wellness' },
  { name: 'stress-management', slug: 'stress-management' },
  { name: 'work-life-balance', slug: 'work-life-balance' },
  { name: 'journaling', slug: 'journaling' },
  { name: 'gratitude', slug: 'gratitude' },
  { name: 'habits', slug: 'habits' },
  { name: 'routines', slug: 'routines' },

  // Personal Finance
  { name: 'investing', slug: 'investing' },
  { name: 'passive-income', slug: 'passive-income' },
  { name: 'cryptocurrency', slug: 'cryptocurrency' },
  { name: 'stock-market', slug: 'stock-market' },
  { name: 'bonds', slug: 'bonds' },
  { name: 'funds', slug: 'funds' },
  { name: 'retirement', slug: 'retirement' },
  { name: 'financial-education', slug: 'financial-education' },
  { name: 'financial-planning', slug: 'financial-planning' },
  { name: 'economics', slug: 'economics' },
  { name: 'personal-finance', slug: 'personal-finance' },
  { name: 'budgeting', slug: 'budgeting' },
  { name: 'frugality', slug: 'frugality' },
  { name: 'fire-movement', slug: 'fire-movement' },
  { name: 'real-estate', slug: 'real-estate' },
  { name: 'dividends', slug: 'dividends' },
  { name: 'portfolio', slug: 'portfolio' },

  // Literature & Writing
  { name: 'fiction', slug: 'fiction' },
  { name: 'non-fiction', slug: 'non-fiction' },
  { name: 'poetry', slug: 'poetry' },
  { name: 'short-story', slug: 'short-story' },
  { name: 'novel', slug: 'novel' },
  { name: 'chronicle', slug: 'chronicle' },
  { name: 'screenplay', slug: 'screenplay' },
  { name: 'journalism', slug: 'journalism' },
  { name: 'creative-writing', slug: 'creative-writing' },
  { name: 'revision', slug: 'revision' },
  { name: 'publishing', slug: 'publishing' },
  { name: 'self-publishing', slug: 'self-publishing' },
  { name: 'world-building', slug: 'world-building' },
  { name: 'narrative', slug: 'narrative' },
  { name: 'character-development', slug: 'character-development' },
  { name: 'plot', slug: 'plot' },
  { name: 'dialogue', slug: 'dialogue' },
  { name: 'editing', slug: 'editing' },
  { name: 'literary-criticism', slug: 'literary-criticism' },
  { name: 'fantasy', slug: 'fantasy' },
  { name: 'sci-fi', slug: 'sci-fi' },
  { name: 'thriller', slug: 'thriller' },
  { name: 'mystery', slug: 'mystery' },
  { name: 'horror', slug: 'horror' },
  { name: 'romance', slug: 'romance' },
  { name: 'historical-fiction', slug: 'historical-fiction' },

  // Gaming
  { name: 'rpg', slug: 'rpg' },
  { name: 'fps', slug: 'fps' },
  { name: 'mmorpg', slug: 'mmorpg' },
  { name: 'indie-game', slug: 'indie-game' },
  { name: 'retro-games', slug: 'retro-games' },
  { name: 'game-design', slug: 'game-design' },
  { name: 'unity', slug: 'unity' },
  { name: 'unreal', slug: 'unreal' },
  { name: 'godot', slug: 'godot' },
  { name: 'pixel-art', slug: 'pixel-art' },
  { name: 'interactive-narrative', slug: 'interactive-narrative' },
  { name: 'speedrun', slug: 'speedrun' },
  { name: 'modding', slug: 'modding' },
  { name: 'emulation', slug: 'emulation' },
  { name: 'esports', slug: 'esports' },
  { name: 'game-streaming', slug: 'game-streaming' },
  { name: 'board-games', slug: 'board-games' },
  { name: 'tabletop', slug: 'tabletop' },
  { name: 'dungeon-master', slug: 'dungeon-master' },
  { name: 'lore', slug: 'lore' },
  { name: 'game-dev', slug: 'game-dev' },

  // Music
  { name: 'music-production', slug: 'music-production' },
  { name: 'music-theory', slug: 'music-theory' },
  { name: 'instruments', slug: 'instruments' },
  { name: 'composition', slug: 'composition' },
  { name: 'mixing', slug: 'mixing' },
  { name: 'mastering', slug: 'mastering' },
  { name: 'daw', slug: 'daw' },
  { name: 'synthesizers', slug: 'synthesizers' },
  { name: 'lo-fi', slug: 'lo-fi' },
  { name: 'jazz', slug: 'jazz' },
  { name: 'rock', slug: 'rock' },
  { name: 'electronic', slug: 'electronic' },
  { name: 'soundtrack', slug: 'soundtrack' },
  { name: 'indie-music', slug: 'indie-music' },
  { name: 'beat-making', slug: 'beat-making' },
  { name: 'sampling', slug: 'sampling' },
  { name: 'music-history', slug: 'music-history' },
  { name: 'classical', slug: 'classical' },
  { name: 'hip-hop', slug: 'hip-hop' },
  { name: 'pop', slug: 'pop' },
  { name: 'metal', slug: 'metal' },
  { name: 'ambient', slug: 'ambient' },

  // Photography & Video
  { name: 'analog-photography', slug: 'analog-photography' },
  { name: 'street-photography', slug: 'street-photography' },
  { name: 'portrait', slug: 'portrait' },
  { name: 'landscape', slug: 'landscape' },
  { name: 'photo-editing', slug: 'photo-editing' },
  { name: 'lightroom', slug: 'lightroom' },
  { name: 'premiere', slug: 'premiere' },
  { name: 'davinci-resolve', slug: 'davinci-resolve' },
  { name: 'cinematography', slug: 'cinematography' },
  { name: 'vlog', slug: 'vlog' },
  { name: 'youtube', slug: 'youtube' },
  { name: 'streaming', slug: 'streaming' },
  { name: 'shorts', slug: 'shorts' },
  { name: 'reels', slug: 'reels' },
  { name: 'documentary', slug: 'documentary' },
  { name: 'color-grading', slug: 'color-grading' },
  { name: 'lens', slug: 'lens' },
  { name: 'camera', slug: 'camera' },
  { name: 'drone-photography', slug: 'drone-photography' },
  { name: 'studio-lighting', slug: 'studio-lighting' },
  { name: 'composition', slug: 'composition' },

  // Anime & Manga
  { name: 'shonen', slug: 'shonen' },
  { name: 'shojo', slug: 'shojo' },
  { name: 'seinen', slug: 'seinen' },
  { name: 'isekai', slug: 'isekai' },
  { name: 'mecha', slug: 'mecha' },
  { name: 'slice-of-life', slug: 'slice-of-life' },
  { name: 'anime-recommendation', slug: 'anime-recommendation' },
  { name: 'manga-analysis', slug: 'manga-analysis' },
  { name: 'light-novel', slug: 'light-novel' },
  { name: 'visual-novel', slug: 'visual-novel' },
  { name: 'doujinshi', slug: 'doujinshi' },
  { name: 'cosplay', slug: 'cosplay' },
  { name: 'dubbing', slug: 'dubbing' },
  { name: 'mangaka', slug: 'mangaka' },
  { name: 'anime-review', slug: 'anime-review' },
  { name: 'otaku-culture', slug: 'otaku-culture' },
  { name: 'studio-ghibli', slug: 'studio-ghibli' },
  { name: 'seasonal-anime', slug: 'seasonal-anime' },
  { name: 'classic-anime', slug: 'classic-anime' },
  { name: 'webtoon', slug: 'webtoon' },

  // Sports
  { name: 'football', slug: 'football' },
  { name: 'basketball', slug: 'basketball' },
  { name: 'tennis', slug: 'tennis' },
  { name: 'swimming', slug: 'swimming' },
  { name: 'running', slug: 'running' },
  { name: 'cycling', slug: 'cycling' },
  { name: 'martial-arts', slug: 'martial-arts' },
  { name: 'olympics', slug: 'olympics' },
  { name: 'sports-nutrition', slug: 'sports-nutrition' },
  { name: 'performance', slug: 'performance' },
  { name: 'training', slug: 'training' },
  { name: 'crossfit', slug: 'crossfit' },
  { name: 'functional-fitness', slug: 'functional-fitness' },
  { name: 'pilates', slug: 'pilates' },
  { name: 'climbing', slug: 'climbing' },
  { name: 'surfing', slug: 'surfing' },
  { name: 'skateboarding', slug: 'skateboarding' },
  { name: 'baseball', slug: 'baseball' },
  { name: 'volleyball', slug: 'volleyball' },

  // Sustainability
  { name: 'environment', slug: 'environment' },
  { name: 'renewable-energy', slug: 'renewable-energy' },
  { name: 'recycling', slug: 'recycling' },
  { name: 'conscious-consumption', slug: 'conscious-consumption' },
  { name: 'carbon-footprint', slug: 'carbon-footprint' },
  { name: 'biodiversity', slug: 'biodiversity' },
  { name: 'agriculture', slug: 'agriculture' },
  { name: 'permaculture', slug: 'permaculture' },
  { name: 'veganism', slug: 'veganism' },
  { name: 'eco-friendly', slug: 'eco-friendly' },
  { name: 'sustainability', slug: 'sustainability' },
  { name: 'climate-change', slug: 'climate-change' },
  { name: 'zero-waste', slug: 'zero-waste' },
  { name: 'green-technology', slug: 'green-technology' },
  { name: 'solar-energy', slug: 'solar-energy' },
  { name: 'electric-vehicles', slug: 'electric-vehicles' },

  // Law & Politics
  { name: 'digital-law', slug: 'digital-law' },
  { name: 'privacy', slug: 'privacy' },
  { name: 'lgpd', slug: 'lgpd' },
  { name: 'gdpr', slug: 'gdpr' },
  { name: 'public-policy', slug: 'public-policy' },
  { name: 'democracy', slug: 'democracy' },
  { name: 'human-rights', slug: 'human-rights' },
  { name: 'legislation', slug: 'legislation' },
  { name: 'jurisprudence', slug: 'jurisprudence' },
  { name: 'activism', slug: 'activism' },
  { name: 'social-justice', slug: 'social-justice' },
  { name: 'compliance', slug: 'compliance' },
  { name: 'intellectual-property', slug: 'intellectual-property' },
  { name: 'international-law', slug: 'international-law' },
  { name: 'criminal-law', slug: 'criminal-law' },
  { name: 'civil-rights', slug: 'civil-rights' },
  { name: 'politics', slug: 'politics' },

  // Astronomy & Space
  { name: 'nasa', slug: 'nasa' },
  { name: 'spacex', slug: 'spacex' },
  { name: 'telescope', slug: 'telescope' },
  { name: 'planets', slug: 'planets' },
  { name: 'black-holes', slug: 'black-holes' },
  { name: 'cosmology', slug: 'cosmology' },
  { name: 'space-exploration', slug: 'space-exploration' },
  { name: 'satellites', slug: 'satellites' },
  { name: 'space-missions', slug: 'space-missions' },
  { name: 'astrophotography', slug: 'astrophotography' },
  { name: 'james-webb', slug: 'james-webb' },
  { name: 'solar-system', slug: 'solar-system' },
  { name: 'exoplanets', slug: 'exoplanets' },
  { name: 'dark-matter', slug: 'dark-matter' },
  { name: 'big-bang', slug: 'big-bang' },
  { name: 'space-travel', slug: 'space-travel' },
  { name: 'rocket-science', slug: 'rocket-science' },

  // Languages
  { name: 'english', slug: 'english' },
  { name: 'spanish', slug: 'spanish' },
  { name: 'japanese', slug: 'japanese' },
  { name: 'mandarin', slug: 'mandarin' },
  { name: 'german', slug: 'german' },
  { name: 'french', slug: 'french' },
  { name: 'language-learning', slug: 'language-learning' },
  { name: 'translation', slug: 'translation' },
  { name: 'linguistics', slug: 'linguistics' },
  { name: 'immersion', slug: 'immersion' },
  { name: 'fluency', slug: 'fluency' },
  { name: 'vocabulary', slug: 'vocabulary' },
  { name: 'grammar', slug: 'grammar' },
  { name: 'exchange', slug: 'exchange' },
  { name: 'accent', slug: 'accent' },
  { name: 'slang', slug: 'slang' },
  { name: 'language-tips', slug: 'language-tips' },
  { name: 'polyglot', slug: 'polyglot' },
  { name: 'second-language', slug: 'second-language' },
  { name: 'cultural-context', slug: 'cultural-context' },

  // Food & Gastronomy
  { name: 'recipe', slug: 'recipe' },
  { name: 'cooking', slug: 'cooking' },
  { name: 'baking', slug: 'baking' },
  { name: 'fermentation', slug: 'fermentation' },
  { name: 'bbq', slug: 'bbq' },
  { name: 'vegan', slug: 'vegan' },
  { name: 'gluten-free', slug: 'gluten-free' },
  { name: 'fast-food', slug: 'fast-food' },
  { name: 'street-food', slug: 'street-food' },
  { name: 'wine', slug: 'wine' },
  { name: 'craft-beer', slug: 'craft-beer' },
  { name: 'coffee', slug: 'coffee' },
  { name: 'cocktails', slug: 'cocktails' },
  { name: 'desserts', slug: 'desserts' },
  { name: 'pastry', slug: 'pastry' },
  { name: 'italian-cuisine', slug: 'italian-cuisine' },
  { name: 'japanese-cuisine', slug: 'japanese-cuisine' },
  { name: 'french-cuisine', slug: 'french-cuisine' },
  { name: 'meal-prep', slug: 'meal-prep' },
  { name: 'food-science', slug: 'food-science' },
  { name: 'nutrition-facts', slug: 'nutrition-facts' },
  { name: 'restaurant', slug: 'restaurant' },
  { name: 'food-history', slug: 'food-history' },
  { name: 'spices', slug: 'spices' },
];

const categorySlugToId: Record<string, string> = {};

async function seedCategories() {
  console.log('Seeding categories...');

  for (const cat of categoryData) {
    const id = createId();
    categorySlugToId[cat.slug] = id;

    await db.insert(categories).values({
      id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? null,
      parentId: cat.parentId ?? null,
    }).onConflictDoNothing({ target: categories.slug });
  }

  for (const cat of categoryData) {
    if (cat.parentId) {
      const parentSlug = slugify(cat.parentId);
      const parentId = categorySlugToId[parentSlug];
      if (parentId && categorySlugToId[cat.slug]) {
        await db
          .update(categories)
          .set({ parentId })
          .where(eq(categories.id, categorySlugToId[cat.slug]!));
      }
    }
  }

  console.log(`Seeded ${categoryData.length} categories`);
}

async function seedTags() {
  console.log('Seeding tags...');

  for (const tag of tagData) {
    const normalizedName = tag.name.trim().toLowerCase();
    const normalizedSlug = tag.slug.trim().toLowerCase();

    await db.insert(tagsTable).values({
      id: createId(),
      name: normalizedName,
      slug: normalizedSlug,
    }).onConflictDoNothing({ target: tagsTable.name });
  }

  console.log(`Seeded ${tagData.length} tags`);
}

async function main() {
  try {
    console.log('Starting seed...');
    console.log(`Database: ${env.DATABASE_URL.split('@')[1]}`);

    await seedCategories();
    await seedTags();

    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

main();
