-- Secure Cœur de Marché Bouaflé Database
-- This script enables Row Level Security (RLS) on all relevant tables to prevent unauthorized access.
-- Ensure that you execute this in your Supabase SQL Editor.

-- ========================================================================================
-- 1. Table: vendeurs
--    Policy:
--    - Anyone can SELECT.
--    - Only authenticated users can INSERT a row (during sign up) where the id matches their auth.uid().
--    - Only authenticated users can UPDATE their own data.
-- ========================================================================================
ALTER TABLE vendeurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendeurs are viewable by everyone."
ON vendeurs FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own vendeur profile."
ON vendeurs FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own vendeur profile."
ON vendeurs FOR UPDATE
USING (auth.uid() = id);

-- ========================================================================================
-- 2. Table: produits
--    Policy:
--    - Anyone can SELECT.
--    - Only authenticated users can INSERT, UPDATE, or DELETE their own products.
--    - Check if the 'vendeur' (WhatsApp string) matches the authenticated user's whatsapp in the vendeurs table.
-- ========================================================================================
ALTER TABLE produits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Produits are viewable by everyone."
ON produits FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own produits."
ON produits FOR INSERT
WITH CHECK (
    vendeur = (SELECT whatsapp FROM vendeurs WHERE id = auth.uid())
);

CREATE POLICY "Users can update their own produits."
ON produits FOR UPDATE
USING (
    vendeur = (SELECT whatsapp FROM vendeurs WHERE id = auth.uid())
);

CREATE POLICY "Users can delete their own produits."
ON produits FOR DELETE
USING (
    vendeur = (SELECT whatsapp FROM vendeurs WHERE id = auth.uid())
);

-- ========================================================================================
-- 3. Table: commandes
--    Policy:
--    - Anyone can INSERT (this represents a customer placing an order from the app).
--    - Only authenticated vendors can SELECT their own orders.
--    - Check if the 'vendeur_tel' (WhatsApp string) matches the authenticated user's whatsapp in the vendeurs table.
-- ========================================================================================
ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create a commande."
ON commandes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Vendors can view their own commandes."
ON commandes FOR SELECT
USING (
    vendeur_tel = (SELECT whatsapp FROM vendeurs WHERE id = auth.uid())
);

-- ========================================================================================
-- 4. Table: interactions_utilisateurs
-- ========================================================================================
ALTER TABLE interactions_utilisateurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log interactions."
ON interactions_utilisateurs FOR INSERT
WITH CHECK (true);

CREATE POLICY "Only authenticated users can view interactions."
ON interactions_utilisateurs FOR SELECT
USING (auth.role() = 'authenticated');

-- ========================================================================================
-- 5. Publicly viewable marketing tables (publicites, tv_market, annonces)
-- ========================================================================================
ALTER TABLE publicites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Publicites viewable by everyone." ON publicites FOR SELECT USING (true);

ALTER TABLE tv_market ENABLE ROW LEVEL SECURITY;
CREATE POLICY "TV Market viewable by everyone." ON tv_market FOR SELECT USING (true);

ALTER TABLE annonces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Annonces viewable by everyone." ON annonces FOR SELECT USING (true);

-- ========================================================================================
-- 6. Storage: images
-- ========================================================================================
CREATE POLICY "Images are publicly accessible."
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

CREATE POLICY "Authenticated users can upload images."
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own images."
ON storage.objects FOR DELETE
USING (bucket_id = 'images' AND auth.uid() = owner);
