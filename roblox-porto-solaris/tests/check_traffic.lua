local fails, n = 0, 0
local function check(c, m) n = n + 1 if not c then fails = fails + 1 print("FAIL: " .. m) end end
local folder = workspace:FindFirstChild("Transito")
local kinds, real = {}, nil
for _, m in ipairs(folder:GetChildren()) do
	kinds[m.Name] = (kinds[m.Name] or 0) + 1
	if m.Name == "Carro" then real = m end
	local root = m.PrimaryPart
	check(root and root.Anchored, m.Name .. " has an anchored root")
	for _, p in ipairs(m:GetDescendants()) do
		if p:IsA("BasePart") and p ~= root then
			if p.Anchored or p.CanCollide then check(false, m.Name .. ": welded parts are unanchored and non-colliding") break end
		end
	end
end
local total = 0 for _, v in pairs(kinds) do total = total + v end
check(total >= 30, "about 30+ vehicles: " .. total)
check((kinds.Carro or 0) >= 1, "real cars in the traffic (mock has 1 of 6 models): " .. tostring(kinds.Carro))
check(kinds.Onibus and kinds.Taxi and kinds.Microonibus and kinds.Bonde == 2, "all kinds present")
-- the real car: scripts, lights, hitboxes and seats handled; root under the car on the ground
check(real ~= nil, "real car built")
if real then
	local bad = false
	for _, d in ipairs(real:GetDescendants()) do
		if d.ClassName == "Script" or d.ClassName == "SpotLight" or d.Name == "Hitbox" then bad = true end
	end
	check(not bad, "no scripts / lights / hitboxes in traffic cars")
	check(real:FindFirstChild("DriveSeat", true).Disabled == true, "seat disabled")
	local root = real.PrimaryPart
	check(root.Name == "Raiz" and root.CanCollide == true and root.Transparency == 1, "invisible colliding root")
	local piv = real:GetPivot()
	check(math.abs(piv.LookVector.Z + 1) < 1e-6 or math.abs(piv.LookVector.Z - 1) < 1 , "pivot is a ground frame")
	local paint = real:FindFirstChild("Paint", true)
	check(paint:GetAttribute("Pintura") == true, "paint tagged (random colour applied)")
	check(real:GetAttribute("Rota") ~= nil and real:GetAttribute("Vel") >= 30, "route attributes")
end
-- U-turn loops on the avenue: points stay within the road (|x| <= 12) and close the loop
for _, m in ipairs(folder:GetChildren()) do
	local r = m:GetAttribute("Rota")
	if r and r:find("^6,") or (r and r:find("^%-?6,%-490")) then
		for x in r:gmatch("([%-%d%.]+),") do
			if math.abs(tonumber(x)) > 12.01 then check(false, "avenue loop stays on the road: x=" .. x) break end
		end
	end
end
print(string.format("traffic: %d checks, %d failed", n, fails))
