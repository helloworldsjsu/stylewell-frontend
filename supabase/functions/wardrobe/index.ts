import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const CATEGORIES = ['T-shirt', 'Shirt', 'Jeans', 'Shorts', 'Jacket', 'Dress', 'Coat', 'Skirt'];
const TOPWEAR = new Set(['T-shirt', 'Shirt', 'Jacket', 'Dress', 'Coat']);
const BOTTOMWEAR = new Set(['Jeans', 'Shorts', 'Skirt']);

const COLOR_MAP: Record<string, string> = {
  red: '#FF0000',
  blue: '#0000FF',
  black: '#000000',
  white: '#FFFFFF',
  grey: '#808080',
  gray: '#808080',
  green: '#00FF00',
  yellow: '#FFFF00',
  pink: '#FFC0CB',
  brown: '#A52A2A',
  navy: '#000080',
  beige: '#F5F5DC',
  orange: '#FFA500',
  purple: '#800080',
};

interface ClassificationResult {
  category: string;
  item_type: 'topwear' | 'bottomwear';
  confidence: number;
  attributes: {
    color: string;
    pattern: string;
    sleeve_type: string;
  };
}

async function classifyClothing(imageData: ArrayBuffer): Promise<ClassificationResult> {
  const mockCategories = ['T-shirt', 'Shirt', 'Jeans', 'Shorts', 'Jacket'];
  const mockColors = ['black', 'white', 'blue', 'grey', 'navy'];
  const mockPatterns = ['solid', 'striped', 'checkered', 'denim'];
  const mockSleeveTypes = ['short', 'full', 'sleeveless', 'N/A'];

  const category = mockCategories[Math.floor(Math.random() * mockCategories.length)];
  const item_type = TOPWEAR.has(category) ? 'topwear' : 'bottomwear';
  const confidence = 0.75 + Math.random() * 0.2;

  return {
    category,
    item_type,
    confidence,
    attributes: {
      color: mockColors[Math.floor(Math.random() * mockColors.length)],
      pattern: mockPatterns[Math.floor(Math.random() * mockPatterns.length)],
      sleeve_type: item_type === 'topwear'
        ? mockSleeveTypes[Math.floor(Math.random() * mockSleeveTypes.length)]
        : 'N/A',
    },
  };
}

async function generateEmbedding(imageData: ArrayBuffer): Promise<number[]> {
  const embedding = Array.from({ length: 512 }, () => Math.random() * 2 - 1);
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / norm);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === 'GET' && path.includes('/items')) {
      const itemId = url.searchParams.get('id');

      if (itemId) {
        const { data, error } = await supabase
          .from('clothing_items')
          .select('*')
          .eq('id', itemId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        return new Response(
          JSON.stringify(data),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        const { data, error } = await supabase
          .from('clothing_items')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(
          JSON.stringify({ items: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (req.method === 'POST' && path.includes('/upload')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return new Response(
          JSON.stringify({ error: 'No file provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const imageData = await file.arrayBuffer();

      const classification = await classifyClothing(imageData);
      const embedding = await generateEmbedding(imageData);

      const fileName = `${user.id}/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('clothing-images')
        .upload(fileName, imageData, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('clothing-images')
        .getPublicUrl(fileName);

      const { data: itemData, error: insertError } = await supabase
        .from('clothing_items')
        .insert({
          user_id: user.id,
          category: classification.category,
          item_type: classification.item_type,
          color: classification.attributes.color,
          pattern: classification.attributes.pattern,
          sleeve_type: classification.attributes.sleeve_type,
          confidence: classification.confidence,
          image_url: fileName,
          embedding: JSON.stringify(embedding),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return new Response(
        JSON.stringify({
          item_id: itemData.id,
          category: classification.category,
          item_type: classification.item_type,
          confidence: classification.confidence,
          attributes: classification.attributes,
          image_url: publicUrl,
          message: 'Item classified and stored successfully',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'DELETE' && path.includes('/items')) {
      const itemId = url.searchParams.get('id');

      if (!itemId) {
        return new Response(
          JSON.stringify({ error: 'Item ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: item } = await supabase
        .from('clothing_items')
        .select('image_url')
        .eq('id', itemId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (item?.image_url) {
        await supabase.storage
          .from('clothing-images')
          .remove([item.image_url]);
      }

      const { error: deleteError } = await supabase
        .from('clothing_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({ message: 'Item deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
