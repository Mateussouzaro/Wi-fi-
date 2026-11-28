-- a fake "Superbo" in ServerStorage.Vehicles (front = -Z), anchored like the real pack
local V = Vector3.new
local veh = game:GetService("ServerStorage").Vehicles
local m = Instance.new("Model", veh) m.Name = "Superbo"
local body = Instance.new("Part", m) body.Name = "Paint" body.Size = V(7, 3, 16) body.CFrame = CFrame.new(0, 2.5, 0) body.Anchored = true
local glass = Instance.new("Part", m) glass.Name = "Glass" glass.Size = V(6, 2, 7) glass.CFrame = CFrame.new(0, 5, 1) glass.Material = "Material.Glass" glass.Anchored = true
local seat = Instance.new("VehicleSeat", m) seat.Name = "DriveSeat" seat.Size = V(2, 1, 2) seat.CFrame = CFrame.new(-1.3, 2.5, 1) seat.Anchored = true
local hit = Instance.new("Part", m) hit.Name = "Hitbox" hit.Transparency = 1 hit.Size = V(8, 5, 17) hit.CFrame = CFrame.new(0, 2.5, 0)
local w = Instance.new("Folder", m) w.Name = "Wheels"
local wheel = Instance.new("Part", w) wheel.Name = "FL" wheel.Size = V(1, 2.6, 2.6) wheel.CFrame = CFrame.new(-3.2, 1.3, -5)
local sl = Instance.new("SpotLight", body)
local sc = Instance.new("Script", body)
