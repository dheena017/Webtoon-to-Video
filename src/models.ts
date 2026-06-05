export interface AIModel {
  id: string;
  name: string;
  type: 'free' | 'paid' | 'open-source';
  provider: string;
}

export const AI_MODELS: AIModel[] = [
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', type: 'free', provider: 'Google' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', type: 'paid', provider: 'Google' },
  { id: 'llama-3-70b', name: 'Llama 3 (via Groq)', type: 'open-source', provider: 'Groq' },
  { id: 'huggingface-mistral-7b', name: 'Mistral 7B (via HuggingFace)', type: 'open-source', provider: 'Hugging Face' },
];
