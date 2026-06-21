import { Scenario, AIModel } from './types';

// OGQ Creators Studio submission specs
// https://creators.ogq.me - 멈춰있는 스티커(이모티콘) 제출 규격
export const OUTPUT_WIDTH = 740;
export const OUTPUT_HEIGHT = 640;

// OGQ 메인 이미지 (스토어 대표 이미지)
export const OGQ_MAIN_WIDTH = 240;
export const OGQ_MAIN_HEIGHT = 240;

// OGQ 탭(목록) 이미지
export const OGQ_TAB_WIDTH = 96;
export const OGQ_TAB_HEIGHT = 74;

// OGQ requires exactly 24 stickers per submission
export const OGQ_REQUIRED_STICKERS = 24;

export const AI_MODELS: AIModel[] = [
  // Google Gemini
  {
    id: 'gemini-2.5-flash-image',
    name: 'Gemini 2.5 Flash Image',
    provider: 'gemini',
    description: '빠른 캐릭터 샘플과 스티커 이미지 생성',
    costPerImage: 0.039,
  },
  {
    id: 'gemini-3-pro-image',
    name: 'Gemini 3 Pro Image',
    provider: 'gemini',
    description: '고품질 일러스트와 복잡한 장면 생성',
    costPerImage: 0.04,
  },
  {
    id: 'gemini-3.1-flash-image',
    name: 'Gemini 3.1 Flash Image',
    provider: 'gemini',
    description: '최신 Flash 이미지 생성 모델',
    costPerImage: 0.039,
  },
  // OpenAI
  {
    id: 'dall-e-3',
    name: 'DALL-E 3',
    provider: 'openai',
    description: 'OpenAI의 최신 이미지 생성 모델',
    costPerImage: 0.04, // $0.040 per image (1024x1024, standard)
  },
  {
    id: 'gpt-image-1',
    name: 'GPT Image',
    provider: 'openai',
    description: 'GPT 기반 이미지 생성',
    costPerImage: 0.02, // $0.02 per image (estimated)
  },
  // Stability AI
  {
    id: 'stable-image-ultra',
    name: 'Stable Image Ultra',
    provider: 'stability',
    description: '최고 품질의 이미지 생성 (SD 3.5 기반)',
    costPerImage: 0.08, // $0.08 per image
  },
  {
    id: 'stable-image-core',
    name: 'Stable Image Core',
    provider: 'stability',
    description: '빠른 속도의 고품질 이미지',
    costPerImage: 0.03, // $0.03 per image
  },
  {
    id: 'sd3.5-large',
    name: 'SD 3.5 Large',
    provider: 'stability',
    description: 'Stable Diffusion 3.5 Large 모델',
    costPerImage: 0.065, // $0.065 per image
  },
  {
    id: 'sd3.5-large-turbo',
    name: 'SD 3.5 Large Turbo',
    provider: 'stability',
    description: '빠른 생성 속도의 SD 3.5',
    costPerImage: 0.04, // $0.04 per image
  },
  // Codex (ChatGPT Plus/Pro OAuth)
  {
    id: 'codex-image-1',
    name: 'Codex Image (ChatGPT Plus/Pro)',
    provider: 'codex',
    description: '로컬 Codex OAuth로 이미지 생성 (구독 기반, API 키 불필요)',
    costPerImage: 0, // Covered by ChatGPT Plus/Pro subscription
  },
];

export const TEXT_MODELS = {
  gemini: [
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', description: '긴 문맥과 고품질 문안' },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', description: '가벼운 비용의 빠른 생성' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '정교한 문안과 긴 문맥 처리' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '안정적인 범용 텍스트 생성' },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '빠르고 경제적인 기본값' },
    { id: 'gpt-4o', name: 'GPT-4o', description: '고품질 문안 생성' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: '균형 잡힌 최신 텍스트 모델' },
  ],
} as const;

export const ART_STYLE_OPTIONS = [
  'Sticker, Flat Vector, 2D',
  'Kawaii mascot',
  'Soft watercolor',
  'Clean anime cel shading',
  'Korean webtoon',
  'Chibi super-deformed',
  'Bold comic ink',
  'Pastel crayon',
  'Colored pencil',
  'Gouache illustration',
  'Retro 90s sticker',
  'Pixel art',
  'Clay-like 3D',
  'Paper cutout',
  'Minimal line art',
  'Thick outline cartoon',
  'Warm hand-drawn',
  'Children book illustration',
  'Cute food package mascot',
  'Rounded vector icon',
  'Pop art',
  'Y2K glossy sticker',
  'Fantasy storybook',
  'Noir comic',
  'Soft plush toy',
  'Manga screentone',
  'Flat geometric',
  'Painterly digital',
  'High contrast emoji style',
];

export const PROVIDER_INFO = {
  gemini: {
    name: 'Google Gemini',
    icon: '🔷',
    keyPlaceholder: 'AIza...',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  openai: {
    name: 'OpenAI',
    icon: '🟢',
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  stability: {
    name: 'Stability AI',
    icon: '🟣',
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.stability.ai/account/keys',
  },
  codex: {
    name: 'Codex (ChatGPT Plus/Pro)',
    icon: '🧠',
    keyPlaceholder: '',
    keyUrl: 'https://github.com/openai/codex',
  },
};

export const SCENARIOS: Scenario[] = [
  {
    id: 'office',
    title: '직장인 일상',
    description: '직장인의 공감되는 일상. 아침 커피부터 야근까지.',
    icon: '💼',
    prompts: [
      "Saying hello cheerfully", "Drinking coffee tiredly", "Typing furiously on keyboard", "Brainstorming idea",
      "Confused looking at screen", "Shocked by error", "Yes/Okay gesture", "No/Refusal gesture",
      "Crying under pile of paper", "Leaving work happily", "Eating lunch happily", "Zoned out in meeting",
      "On the phone busy", "Thumbs up approval", "Begging for help", "Angry with fire eyes",
      "celebrating success", "Checking watch waiting", "Exhausted face", "Bow of apology",
      "Sparkling eyes motivation", "Drowning in emails", "Ghosting/Disappearing", "Good night sleeping"
    ]
  },
  {
    id: 'cute_rabbit',
    title: '귀여운 토끼',
    description: '클래식한 귀여운 마스코트 감정. 일상 대화에 딱.',
    icon: '🐰',
    prompts: [
      "Waving hello", "Heart eyes in love", "Laughing out loud", "Crying tears",
      "Angry pouting", "Sleeping with snot bubble", "Eating a carrot", "Question mark curious",
      "Sparkles excited", "Shocked wide eyes", "Embarrassed blushing", "Cheering with pompoms",
      "Ok sign", "X sign with arms", "Trembling in fear", "Dancing happy",
      "Sending a kiss", "Taking a photo", "Writing a note", "Peeking from wall",
      "Sunglasses cool", "Sweating nervous", "Hugging a heart", "Bowing thank you"
    ]
  },
  {
    id: 'lazy_cat',
    title: '게으른 고양이',
    description: '시니컬하고 느긋한 현대인의 바이브.',
    icon: '🐱',
    prompts: [
      "Sleeping in box", "Ignoring you", "Stretching long", "Hissing angry",
      "Grooming paw", "Staring blankly", "Knocking cup off table", "Judging you",
      "Hungry holding bowl", "Zoomies running", "Liquid cat melting", "Grumpy face",
      "In a paper bag", "Paw high five", "Scared arching back", "Purring happy",
      "Laptop sitting", "Chasing laser pointer", "Belly up trust", "Spying eyes",
      "Biting hand play", "Kneading dough", "Yawning wide", "Tail wagging annoyed"
    ]
  },
  {
    id: 'happy_dog',
    title: '행복한 강아지',
    description: '충성스럽고 활발한 강아지의 다양한 표정.',
    icon: '🐶',
    prompts: [
      "Wagging tail excited", "Tilting head curious", "Puppy eyes begging", "Barking loud",
      "Chasing own tail", "Fetching ball happy", "Sleeping curled up", "Panting with tongue out",
      "Rolling on back playful", "Jumping for joy", "Sniffing around", "Eating treats eagerly",
      "Wet after bath shake", "Digging hole", "Howling at moon", "Licking face love",
      "Sad waiting at door", "Playing with toy", "Running fast", "Cuddling owner",
      "Scared of thunder", "Wearing cone shame", "Proud sitting pose", "Dreaming twitch"
    ]
  },
  {
    id: 'baby_penguin',
    title: '아기 펭귄',
    description: '뒤뚱뒤뚱 귀여운 펭귄의 남극 라이프.',
    icon: '🐧',
    prompts: [
      "Waddling walk", "Sliding on belly", "Huddling for warmth", "Flapping tiny wings",
      "Eating fish happily", "Slipping on ice", "Looking up curious", "Shivering cold",
      "Swimming diving", "Calling for parent", "Standing in group", "Fluffy baby pose",
      "Surprised expression", "Happy dance", "Sleepy standing", "Hiding behind parent",
      "Playing in snow", "Pecking at ice", "Jumping into water", "Waving flipper hello",
      "Confused lost look", "Proud chest out", "Tumbling fall", "Cozy sleeping"
    ]
  },
  {
    id: 'student_life',
    title: '학생 일상',
    description: '학교생활의 희로애락. 시험, 친구, 방학까지.',
    icon: '📚',
    prompts: [
      "Studying hard", "Sleeping in class", "Raising hand eager", "Shocked by test score",
      "Eating lunch box", "Chatting with friends", "Running late to class", "Daydreaming",
      "Celebrating vacation", "Cramming before exam", "Confused by math", "Taking notes",
      "Playing during break", "Bored in lecture", "Happy with good grade", "Crying over homework",
      "Presenting nervous", "High five with friend", "Packing school bag", "Yawning tired",
      "Excited for field trip", "Detention sad", "Graduation happy", "First day nervous"
    ]
  },
  {
    id: 'foodie',
    title: '먹방 캐릭터',
    description: '맛있는 음식 앞에서의 다양한 반응.',
    icon: '🍔',
    prompts: [
      "Drooling at food", "Taking food photo", "Eating deliciously", "Full belly pat",
      "Cooking happily", "Waiting for order", "Tasting something sour", "Spicy sweating",
      "Sharing food", "Sneaking midnight snack", "Food coma sleepy", "Disappointed by taste",
      "Excited for dessert", "Drinking bubble tea", "Eating noodles slurp", "Birthday cake joy",
      "BBQ grilling", "Ice cream brain freeze", "Pizza love", "Hungry stomach growl",
      "Trying new food curious", "Chef kiss delicious", "Overeating regret", "Coffee addict"
    ]
  },
  {
    id: 'gamer',
    title: '게이머',
    description: '게임할 때의 희로애락과 다양한 반응.',
    icon: '🎮',
    prompts: [
      "Victory pose", "Rage quit angry", "Focused gaming", "Celebrating win",
      "Crying after loss", "Surprised plot twist", "Tired all-nighter", "Excited new game",
      "Trash talking", "Teamwork high five", "Loading screen bored", "Headset on ready",
      "Button mashing", "Scared horror game", "Speed running", "AFK away",
      "Lag frustrated", "Loot drop excited", "Boss defeated relief", "Tutorial skipping",
      "Pay to win sad", "Easter egg found", "Streaming wave", "GG handshake"
    ]
  },
  {
    id: 'fitness',
    title: '운동하는 캐릭터',
    description: '헬스, 요가, 러닝 등 운동하는 모습.',
    icon: '💪',
    prompts: [
      "Lifting weights", "Running on treadmill", "Yoga tree pose", "Stretching warmup",
      "Exhausted after workout", "Drinking protein shake", "Flexing muscles proud", "Sweating hard",
      "Resting between sets", "Checking fitness app", "Doing pushups", "Jumping rope",
      "Swimming laps", "Cycling fast", "Plank holding", "Boxing punching",
      "Victory after PR", "Sore muscles pain", "Morning jog", "Cool down stretch",
      "Gym selfie", "Skipping leg day shame", "Healthy meal prep", "Sleep for recovery"
    ]
  },
  {
    id: 'love_couple',
    title: '커플 이모티콘',
    description: '연인들의 달달한 일상과 다양한 감정.',
    icon: '💑',
    prompts: [
      "Holding hands", "Heart eyes at each other", "Kissing cheek", "Hugging tight",
      "Fighting angry", "Making up sorry", "Couple selca", "Matching outfits",
      "Jealous pout", "Missing you sad", "Video call happy", "Anniversary celebration",
      "Cooking together", "Movie date", "Walking together", "Surprise gift",
      "Comforting hug", "Playful teasing", "Sleeping together cute", "Promise pinky",
      "First date nervous", "Proposal shocked", "Back hug", "Forehead kiss"
    ]
  },
  {
    id: 'weather_mood',
    title: '날씨와 기분',
    description: '다양한 날씨에 따른 감정과 반응.',
    icon: '🌤️',
    prompts: [
      "Sunny day happy", "Rainy day umbrella", "Snowy day excited", "Hot summer melting",
      "Windy hair mess", "Rainbow amazed", "Thunder scared", "Foggy confused",
      "Autumn leaves falling", "Spring flowers happy", "Cloudy gloomy", "Starry night peaceful",
      "Sunrise energized", "Sunset relaxed", "Humidity annoyed", "Cold shivering",
      "Puddle jumping", "Sunburn ouch", "Snowman building", "Cherry blossom viewing",
      "Beach vacation", "Typhoon worried", "Clear sky refreshed", "Cozy rainy day indoor"
    ]
  },
  {
    id: 'party_celebration',
    title: '파티와 축하',
    description: '생일, 새해, 각종 기념일 축하 이모티콘.',
    icon: '🎉',
    prompts: [
      "Birthday cake candles", "Popping confetti", "Cheers toast", "Dancing party",
      "New year countdown", "Fireworks amazed", "Opening gift excited", "Balloon holding",
      "Party hat wearing", "Karaoke singing", "DJ spinning", "Conga line",
      "Champagne popping", "Photo booth pose", "Surprise party shocked", "Thank you bow",
      "Congratulations clap", "Wedding celebration", "Graduation cap toss", "Achievement unlocked",
      "Group photo", "Cake smash", "Party tired", "Cleanup after party"
    ]
  },
  {
    id: 'space_astronaut',
    title: '우주 탐험가',
    description: '귀여운 우주인의 은하계 모험.',
    icon: '🚀',
    prompts: [
      "Floating in space", "Moon landing", "Rocket launching", "Planet discovering",
      "Alien meeting friendly", "Space helmet on", "Zero gravity tumble", "Star gazing",
      "Space food eating", "Meteor dodging", "Flag planting", "Spacewalk adventure",
      "UFO spotting", "Black hole scared", "Satellite fixing", "Earth viewing",
      "Space selfie", "Comet riding", "Galaxy exploring", "Oxygen tank checking",
      "Communication signal", "Asteroid mining", "Space station arriving", "Home return happy"
    ]
  }
];
