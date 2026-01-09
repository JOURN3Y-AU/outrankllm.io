const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ubfskwsjqdyeunttsqvt.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteTestUser(targetEmail) {
  console.log('Deleting all data for:', targetEmail);

  // Get all leads for this email (case-insensitive)
  const { data: leads, error: leadsErr } = await supabase
    .from('leads')
    .select('id')
    .ilike('email', targetEmail);

  if (leadsErr) {
    console.error('Error fetching leads:', leadsErr);
    return;
  }

  if (!leads || leads.length === 0) {
    console.log('No leads found for:', targetEmail);
    return;
  }

  const leadIds = leads.map(l => l.id);
  console.log('Found', leadIds.length, 'leads to delete');

  // Get all scan runs for these leads
  const { data: runs } = await supabase
    .from('scan_runs')
    .select('id')
    .in('lead_id', leadIds);

  const runIds = runs ? runs.map(r => r.id) : [];
  console.log('Found', runIds.length, 'scan runs');

  if (runIds.length > 0) {
    // Delete brand awareness results
    const { error: e1 } = await supabase.from('brand_awareness_results').delete().in('run_id', runIds);
    console.log('Deleted brand_awareness_results:', e1 ? e1.message : 'OK');

    // Delete reports
    const { error: e2 } = await supabase.from('reports').delete().in('run_id', runIds);
    console.log('Deleted reports:', e2 ? e2.message : 'OK');

    // Delete llm_responses
    const { error: e3 } = await supabase.from('llm_responses').delete().in('run_id', runIds);
    console.log('Deleted llm_responses:', e3 ? e3.message : 'OK');

    // Delete site_analyses
    const { error: e4 } = await supabase.from('site_analyses').delete().in('run_id', runIds);
    console.log('Deleted site_analyses:', e4 ? e4.message : 'OK');

    // Delete scan_prompts
    const { error: e5 } = await supabase.from('scan_prompts').delete().in('run_id', runIds);
    console.log('Deleted scan_prompts:', e5 ? e5.message : 'OK');
  }

  // Delete email_verification_tokens
  const { error: e6 } = await supabase.from('email_verification_tokens').delete().in('lead_id', leadIds);
  console.log('Deleted email_verification_tokens:', e6 ? e6.message : 'OK');

  // Delete password_reset_tokens
  const { error: e7 } = await supabase.from('password_reset_tokens').delete().in('lead_id', leadIds);
  console.log('Deleted password_reset_tokens:', e7 ? e7.message : 'OK');

  // Delete subscriptions
  const { error: e8 } = await supabase.from('subscriptions').delete().in('lead_id', leadIds);
  console.log('Deleted subscriptions:', e8 ? e8.message : 'OK');

  // Delete scan_runs
  const { error: e9 } = await supabase.from('scan_runs').delete().in('lead_id', leadIds);
  console.log('Deleted scan_runs:', e9 ? e9.message : 'OK');

  // Delete leads
  const { error: e10 } = await supabase.from('leads').delete().in('id', leadIds);
  console.log('Deleted leads:', e10 ? e10.message : 'OK');

  console.log('\nCleanup complete for:', targetEmail);
}

// Get email from command line or use default
const email = process.argv[2] || 'kevin.morrell@JOURN3Y.com.au';
deleteTestUser(email);
