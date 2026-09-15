
-- ========================================================================================
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
--    - 'vendeur' column should match auth.uid(). Note: depending on schema, you might need to adapt the logic.
-- ========================================================================================
ALTER TABLE produits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Produits are viewable by everyone."
ON produits FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own produits."
ON produits FOR INSERT
WITH CHECK (vendeur = (SELECT whatsapp FROM vendeurs WHERE id = auth.uid()));

CREATE POLICY "Users can update their own produits."
ON produits FOR UPDATE
USING (vendeur = (SELECT whatsapp FROM vendeurs WHERE id = auth.uid()));

CREATE POLICY "Users can delete their own produits."
ON produits FOR DELETE
USING (vendeur = (SELECT whatsapp FROM vendeurs WHERE id = auth.uid()));

-- ========================================================================================
-- 3. Table: commandes
--    Policy:
--    - Anyone can INSERT (this represents a customer placing an order from the app).
--    - Only authenticated vendors can SELECT their own orders (if applicable).
-- ========================================================================================
ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create a commande."
ON commandes FOR INSERT
WITH CHECK (true);


-- Vendors can view their own commands
CREATE POLICY "Vendors can view their own commandes."
ON commandes FOR SELECT
USING (vendeur_tel = (SELECT whatsapp FROM vendeurs WHERE id = auth.uid()));

-- ========================================================================================
-- 4. Table: interactions_utilisateurs
--    Policy:
--    - Anyone can INSERT interaction data.
--    - Only authenticated admins/users can SELECT (or restrict completely if only for backend analytics).
-- ========================================================================================
ALTER TABLE interactions_utilisateurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log interactions."
ON interactions_utilisateurs FOR INSERT
WITH CHECK (true);

-- Restrict SELECT to authenticated users or disable entirely for public
CREATE POLICY "Only authenticated users can view interactions."
ON interactions_utilisateurs FOR SELECT
USING (auth.role() = 'authenticated');

-- ========================================================================================
-- 5. Publicly viewable marketing tables (publicites, tv_market, annonces)
--    Policy:
--    - Anyone can SELECT.
--    - Only authenticated admins can INSERT/UPDATE/DELETE.
-- ========================================================================================
ALTER TABLE publicites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Publicites viewable by everyone." ON publicites FOR SELECT USING (true);

ALTER TABLE tv_market ENABLE ROW LEVEL SECURITY;
CREATE POLICY "TV Market viewable by everyone." ON tv_market FOR SELECT USING (true);

ALTER TABLE annonces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Annonces viewable by everyone." ON annonces FOR SELECT USING (true);

-- ========================================================================================
-- 6. Storage: images
--    Policy:
--    - Anyone can view objects in the 'images' bucket.
--    - Only authenticated users can upload or delete objects.
-- ========================================================================================
-- Storage policies are applied to the storage.objects table
CREATE POLICY "Images are publicly accessible."
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

CREATE POLICY "Authenticated users can upload images."
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own images."
ON storage.objects FOR DELETE
USING (bucket_id = 'images' AND auth.uid() = owner);
