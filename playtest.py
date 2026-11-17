"""Drive Sunset Bay in headless Chromium: load the title screen, start a
new game, walk, steal a car, drive it, check the wanted level and the
first job, and capture the four screenshots."""
import json
import sys
import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8080"
SHOTS = [
    ("1-start.jpg", "?shot=start&seed=1"),
    ("2-drive.jpg", "?shot=drive&seed=1"),
    ("3-chase.jpg", "?shot=chase&seed=1"),
    ("4-mission.jpg", "?shot=mission&seed=1"),
]

LAUNCH_ARGS = [
    "--use-gl=angle", "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader", "--disable-gpu-sandbox",
]


def check_shots(page, errors):
    for name, query in SHOTS:
        page.goto(BASE + "/" + query, wait_until="load")
        try:
            page.wait_for_function("window.__shotReady === true", timeout=240000)
        except Exception as exc:
            print(f"SHOT {name}: __shotReady never set: {exc}")
            print("gameError:", page.evaluate("window.__gameError || null"))
            continue
        time.sleep(0.3)
        page.screenshot(path=f"screenshots/{name}", type="jpeg", quality=82)
        print(f"SHOT {name}: ok, gameError={page.evaluate('window.__gameError || null')}")
    print("CONSOLE ERRORS:", json.dumps(errors, indent=1) if errors else "none")


def check_play(page, errors):
    page.goto(BASE + "/", wait_until="load")
    page.wait_for_timeout(2500)
    print("title state:", page.evaluate("window.__game && window.__game.state"))
    print("gameError:", page.evaluate("window.__gameError || null"))
    page.click("#btnNew")
    page.wait_for_timeout(500)
    print("after New Game:", page.evaluate("window.__game.state"))
    before = page.evaluate("[window.__game.world.player.x, window.__game.world.player.z]")
    page.keyboard.down("w")
    page.wait_for_timeout(2000)
    page.keyboard.up("w")
    after = page.evaluate("[window.__game.world.player.x, window.__game.world.player.z]")
    print("walked on foot:", before, "->", after)
    # Stand the hero next to a parked car so the test does not have to walk
    # across town for it.
    page.evaluate("""() => {
      const w = window.__game.world;
      const car = w.cars.find(c => !c.traffic && !c.police && !c.isGold);
      w.player.x = car.x + 2; w.player.z = car.z;
      w.player.mesh.position.set(w.player.x, 0, w.player.z);
    }""")
    page.keyboard.press("e")
    page.wait_for_timeout(400)
    print("in car:", page.evaluate("!!window.__game.world.playerCar"),
          "wanted:", page.evaluate("window.__game.world.police.wanted"))
    page.keyboard.down("w")
    page.wait_for_timeout(3000)
    page.keyboard.up("w")
    print("car speed:", page.evaluate("window.__game.world.playerCar && window.__game.world.playerCar.speed"),
          "car pos:", page.evaluate("window.__game.world.playerCar && [window.__game.world.playerCar.x, window.__game.world.playerCar.z]"))
    print("job:", page.evaluate("window.__game.world.missions.objectiveLabel()"))
    print("health:", page.evaluate("window.__game.world.player.health"))
    # Force three stars and check the police answer.
    page.evaluate("window.__game.world.police.setWanted(3)")
    page.wait_for_timeout(2500)
    print("police cars at 3 stars:",
          page.evaluate("window.__game.world.cars.filter(c => c.police).length"))
    # Finish job 1: teleport the car onto the garage.
    page.evaluate("""() => {
      const w = window.__game.world;
      const g = w.city.landmarks.garage;
      if (w.playerCar) { w.playerCar.x = g.x; w.playerCar.z = g.z; }
    }""")
    page.wait_for_timeout(1500)
    print("jobs done:", page.evaluate("window.__game.world.completedMissions"),
          "cash:", page.evaluate("window.__game.world.player.cash"))
    print("CONSOLE ERRORS:", json.dumps(errors, indent=1) if errors else "none")
    print("gameError:", page.evaluate("window.__gameError || null"))


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "playtest"
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=LAUNCH_ARGS)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        if mode == "shots":
            check_shots(page, errors)
        else:
            check_play(page, errors)
        browser.close()


if __name__ == "__main__":
    main()
