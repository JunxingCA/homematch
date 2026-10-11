-- Local development only. Synthetic catalog, not live OneMap verification.
insert into public.location_catalog(id,label,latitude,longitude,source) values
('fixture-ntu','Nanyang Technological University',1.3483,103.6831,'fixture'),
('fixture-raffles','Raffles Place MRT',1.2841,103.8515,'fixture'),
('fixture-tampines','Tampines MRT',1.3545,103.9452,'fixture'),
('fixture-bishan','Bishan MRT',1.3509,103.8482,'fixture')
on conflict (id) do nothing;
