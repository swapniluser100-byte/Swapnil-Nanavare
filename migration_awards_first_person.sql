-- Converts award descriptions that were written in third person ("स्वप्नील नानावरे यांना...")
-- to first person ("मला..."), since Swapnil is the one speaking on his own website.
--
-- This only affects descriptions matching these exact known patterns (the ones seeded via
-- seed_awards_from_bio.sql, and the Manthan Foundation award added earlier). It will NOT
-- touch visitor comments, or any award description you've written yourself in a different style.
--
-- Run once:
-- wrangler d1 execute swapnil_nanavare_db --file=./migration_awards_first_person.sql --remote

UPDATE awards
SET description = REPLACE(description, 'स्वप्नील नानावरे यांना', 'मला')
WHERE description LIKE 'स्वप्नील नानावरे यांना%';

UPDATE awards
SET description = REPLACE(description, 'स्वप्नील शिवाजी ननवरे (मुरगूड) यांना', 'मला')
WHERE description LIKE 'स्वप्नील शिवाजी ननवरे (मुरगूड) यांना%';
