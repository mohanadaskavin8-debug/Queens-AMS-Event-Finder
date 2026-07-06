-- Deterministic, idempotent seed for campus buildings.
-- Establishes the canonical building set with category metadata and image URLs.
-- Safe to re-run: existing rows are updated in place; footprints already present
-- in the database are preserved (this seed does not carry footprint geometry).
--
-- Run with:  psql "$DATABASE_URL" -f lib/db/seed/buildings.sql
-- or:        pnpm --filter @workspace/db run seed

INSERT INTO buildings (id, name, short_name, category, image_url, latitude, longitude, levels, description) VALUES
  (1,  'Grant Hall',                                   'Grant Hall',        'landmarks',    NULL, 44.226025, -76.495125, 3, 'Queen''s iconic limestone landmark, home to convocations, concerts, and major university ceremonies.'),
  (2,  'Kingston Hall',                                'Kingston Hall',     'academic',     NULL, 44.2257,   -76.49492,  3, 'Historic arts and social sciences building hosting lectures, panels, and student events.'),
  (3,  'Mitchell Hall',                                'Mitchell Hall',     'student_life', NULL, 44.226986, -76.49776,  4, 'Modern innovation and event hub featuring the Innovation and Wellness Centre.'),
  (4,  'Athletics & Recreation Centre',                'ARC',               'student_life', NULL, 44.2232,   -76.49805,  3, 'Queen''s flagship athletics facility with gymnasiums, pool, courts, and fitness studios.'),
  (5,  'John Deutsch University Centre',               'JDUC',              'student_life', NULL, 44.2264,   -76.4958,   4, 'The heart of student life — AMS offices, dining, and event spaces.'),
  (6,  'Goodes Hall',                                  'Goodes Hall',       'academic',     NULL, 44.228203, -76.49797,  5, 'Home of the Smith School of Business and its career and networking events.'),
  (7,  'Stauffer Library',                             'Stauffer Library',  'landmarks',    NULL, 44.22835,  -76.496254, 4, 'Queen''s main research library with study spaces, archives, and academic workshops.'),
  (8,  'BioSciences Complex',                          'BioSciences',       'academic',     NULL, 44.2272,   -76.4919,   6, 'Life sciences research and teaching complex hosting seminars and symposia.'),
  (9,  'Walter Light Hall',                            'Walter Light Hall', 'academic',     NULL, 44.22797,  -76.491714, 4, 'Engineering hub with labs, maker spaces, and lecture theatres.'),
  (10, 'Isabel Bader Centre for the Performing Arts',  'Isabel Bader',      'landmarks',    NULL, 44.22033,  -76.50653,  3, 'Waterfront performing arts centre featuring theatre, music, film, and exhibitions.'),
  (11, 'Beamish-Munro Hall',                           'Beamish-Munro',     'academic',     NULL, 44.228184, -76.492355, 4, 'The Integrated Learning Centre — design teams, prototyping, and engineering showcases.'),
  (12, 'Agnes Etherington Art Centre',                 'Agnes Etherington', 'landmarks',    NULL, 44.225426, -76.496124, 2, 'Queen''s public art gallery hosting exhibitions, openings, and cultural events.'),
  (13, 'Theological Hall',                             'Theological Hall',  'landmarks',    NULL, 44.22566,  -76.49357,  3, 'Historic hall housing Convocation Hall and the Dan School of Drama and Music.'),
  (14, 'Ban Righ Hall',                                'Ban Righ Hall',     'residences',   NULL, 44.224625, -76.496216, 3, 'Beloved dining hall and gathering space at the centre of west campus residences.'),
  (15, 'Ontario Hall',                                 'Ontario Hall',      'academic',     NULL, 44.22745,  -76.49476,  4, 'Historic limestone academic building overlooking Lake Ontario, home to teaching and departmental offices.'),
  (16, 'Chernoff Hall',                                'Chernoff Hall',     'academic',     NULL, 44.2253,   -76.4934,   5, 'Modern home of the Department of Chemistry, with research and teaching laboratories.'),
  (17, 'Victoria Hall',                                'Victoria Hall',     'residences',   NULL, 44.2249,   -76.4966,   6, 'One of the largest student residences on campus, housing hundreds of first-year students.'),
  (18, 'Watts Hall',                                   'Watts Hall',        'residences',   NULL, 44.2238,   -76.4985,   4, 'Residence hall near West Campus green space, offering a close-knit living community.')
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  short_name  = EXCLUDED.short_name,
  category    = EXCLUDED.category,
  image_url   = COALESCE(EXCLUDED.image_url, buildings.image_url),
  latitude    = EXCLUDED.latitude,
  longitude   = EXCLUDED.longitude,
  levels      = EXCLUDED.levels,
  description = EXCLUDED.description;

-- Keep the serial sequence ahead of the explicit ids inserted above so future
-- application inserts do not collide.
SELECT setval(pg_get_serial_sequence('buildings', 'id'), (SELECT MAX(id) FROM buildings));
