// supabase.js
const dbUrl = 'https://szhxxohizqnwcmsltjtq.supabase.co';
const dbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6aHh4b2hpenFud2Ntc2x0anRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMjE3MzcsImV4cCI6MjA5MTU5NzczN30.L0cczdas6kwaOSEehHF5s7nYU06W0u1s2_cRaytbRzw';

if (window.supabase) {
    window.supabaseClient = window.supabase.createClient(dbUrl, dbKey);
} else {
    console.error('Supabase library is not loaded.');
}
