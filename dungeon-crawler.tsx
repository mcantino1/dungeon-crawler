"use client"

import { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Sword, Heart, Key } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

// Update the Difficulty type to include roguerun
type Difficulty = "easy" | "normal" | "hard" | "adventurer" | "roguerun"

// Difficulty configuration
const DIFFICULTY_SETTINGS = {
  easy: {
    size: 5,
    enemyCount: 3,
    potionCount: 1,
    wallMultiplier: 1.5, // Base wall multiplier
    label: "Easy (5×5 grid, fewer monsters)",
  },
  normal: {
    size: 6,
    enemyCount: 4,
    potionCount: 1,
    wallMultiplier: 1.5, // Base wall multiplier
    label: "Normal (6×6 grid, balanced challenge)",
  },
  hard: {
    size: 8,
    enemyCount: 6,
    potionCount: 2,
    wallMultiplier: 2.0, // Increased wall multiplier for Hard
    label: "Hard (8×8 grid, more monsters and walls)",
  },
  adventurer: {
    size: 10,
    enemyCount: 10,
    potionCount: 3,
    wallMultiplier: 2.5, // Significantly increased wall multiplier for Adventurer
    label: "Adventurer (10×10 grid, maximum challenge with complex maze)",
  },
  roguerun: {
    size: 6, // Start with normal size
    enemyCount: 4, // Start with normal enemy count
    potionCount: 1, // Start with normal potion count
    wallMultiplier: 1.5, // Start with normal wall multiplier
    label: "Rogue Run (See how long you can survive in the ancient dungeon)",
  },
}

// Game constants
const VOID_CHANCE = 0.25 // 25% chance to have a void in the dungeon (reduced from 30%)

type Position = {
  x: number
  y: number
}

// Update the Entity type to include originalHealth and encounterCount
type Entity = {
  id: string
  position: Position
  type: "player" | "enemy" | "health" | "wall" | "exit" | "key" | "void"
  health?: number
  originalHealth?: number // Add this to track original health
  attack?: number
  description: string
  reactionDescription?: string
  secondReactionDescription?: string // Add this for third encounter
  monsterType?: string
  hasBeenAttacked?: boolean
  encounterCount?: number // Add this to track number of encounters
  discovered?: boolean // Track if an entity has been discovered
}

// Room description type
type RoomDescription = {
  description: string
  visited: boolean
}

// New type for Rogue Run state
type RogueRunState = {
  active: boolean
  round: number
  difficulty: "normal" | "hard" | "adventurer"
  extraMonsters: number
  pendingNextRound: boolean
}

export default function DungeonCrawler() {
  const [difficulty, setDifficulty] = useState<Difficulty>("normal")
  const [gameStarted, setGameStarted] = useState(false)
  const [dungeonSize, setDungeonSize] = useState(DIFFICULTY_SETTINGS.normal.size)
  const [enemyCount, setEnemyCount] = useState(DIFFICULTY_SETTINGS.normal.enemyCount)
  const [potionCount, setPotionCount] = useState(DIFFICULTY_SETTINGS.normal.potionCount)
  const [wallMultiplier, setWallMultiplier] = useState(DIFFICULTY_SETTINGS.normal.wallMultiplier)

  const [player, setPlayer] = useState<Entity>({
    id: "player",
    position: { x: 0, y: 0 },
    type: "player",
    health: 100,
    attack: 20,
    description: "You, the brave adventurer",
  })

  const [entities, setEntities] = useState<Entity[]>([])
  const [gameMap, setGameMap] = useState<string[][]>([])
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing")
  const [gameLog, setGameLog] = useState<string[]>([])
  const [visitedTiles, setVisitedTiles] = useState<boolean[][]>([])
  const [roomDescriptions, setRoomDescriptions] = useState<RoomDescription[][]>([])
  const [hasKey, setHasKey] = useState(false)
  const [usedRoomDescriptions, setUsedRoomDescriptions] = useState<Set<string>>(new Set())
  const [monsterEncounters, setMonsterEncounters] = useState<Record<string, number>>({})
  const [hasVoid, setHasVoid] = useState(false)
  const [currentLocationDescription, setCurrentLocationDescription] = useState<string>("")
  const [preventPageScroll, setPreventPageScroll] = useState(true)

  // Replace multiple Rogue Run state variables with a single state object
  const [rogueRun, setRogueRun] = useState<RogueRunState>({
    active: false,
    round: 1,
    difficulty: "normal",
    extraMonsters: 0,
    pendingNextRound: false,
  })

  // Flag to track if map generation is in progress
  const mapGenerationInProgress = useRef(false)

  // Ref to track if a move is in progress (to prevent double moves)
  const moveInProgress = useRef(false)
  // Ref for the play again button
  const playAgainButtonRef = useRef<HTMLButtonElement>(null)
  // Ref for the change difficulty button
  const changeDifficultyButtonRef = useRef<HTMLButtonElement>(null)

  const announcementRef = useRef<HTMLDivElement>(null)
  const gameLogEndRef = useRef<HTMLDivElement>(null)
  const gameContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const welcomeRef = useRef<HTMLDivElement>(null)

  // Update difficulty settings when difficulty changes
  useEffect(() => {
    const settings = DIFFICULTY_SETTINGS[difficulty]
    setDungeonSize(settings.size)
    setEnemyCount(settings.enemyCount)
    setPotionCount(settings.potionCount)
    setWallMultiplier(settings.wallMultiplier)
  }, [difficulty])

  // Set initial focus when game starts
  useEffect(() => {
    if (gameStarted && welcomeRef.current) {
      // Set focus to the welcome message when game starts
      welcomeRef.current.focus()
    }
  }, [gameStarted])

  // Prevent any scrolling to eliminate screen shaking
  useLayoutEffect(() => {
    // Disable scrolling completely
    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"

    // Make sure the content is visible without scrolling
    document.body.style.height = "100vh"
    document.documentElement.style.height = "100vh"

    return () => {
      // Restore scrolling when component unmounts
      document.body.style.overflow = ""
      document.documentElement.style.overflow = ""
      document.body.style.height = ""
      document.documentElement.style.height = ""
    }
  }, [])

  // Update the monsterTypes array to include secondReactionDescription
  const monsterTypes = [
    {
      name: "Goblin",
      description: "A small, wiry creature with green skin and sharp teeth. It brandishes a crude dagger.",
      reactionDescription:
        "The goblin snarls in pain, its yellow eyes narrowing with hatred as it lunges forward more aggressively.",
      secondReactionDescription:
        "The goblin's movements become erratic and desperate, foam flecking at the corners of its mouth as it fights with reckless abandon.",
    },
    {
      name: "Skeleton",
      description: "Animated bones clatter as this undead warrior raises its rusty sword toward you.",
      reactionDescription:
        "Bone fragments scatter across the floor as the skeleton's jaw opens in a silent scream, its eye sockets glowing with an eerie red light.",
      secondReactionDescription:
        "The skeleton's bones begin to crack and splinter, yet it continues its relentless advance, its movements becoming jerky and unpredictable.",
    },
    {
      name: "Giant Rat",
      description: "A rat the size of a dog, with glowing red eyes and diseased-looking fur.",
      reactionDescription:
        "The giant rat squeals in pain and fury, foam dripping from its mouth as it bares its yellowed fangs.",
      secondReactionDescription:
        "The rat's movements become frenzied and unpredictable, its body contorting unnaturally as it fights with the desperation of a cornered animal.",
    },
    {
      name: "Slime",
      description: "A gelatinous blob that oozes across the floor, dissolving everything in its path.",
      reactionDescription:
        "The slime bubbles violently where your weapon struck it, splitting briefly before reforming with an angry pulsating motion.",
      secondReactionDescription:
        "The slime's color darkens to an ominous hue as it begins to emit a noxious vapor, its surface roiling with increased aggression.",
    },
    {
      name: "Cave Spider",
      description: "A spider as large as your torso, with hairy legs and venomous fangs dripping with poison.",
      reactionDescription:
        "The cave spider rears up on its back legs, revealing a pulsating abdomen and making a horrifying hissing sound.",
      secondReactionDescription:
        "The spider's movements become lightning-fast and erratic, its many eyes gleaming with malevolent intelligence as it weaves unpredictably around your attacks.",
    },
    {
      name: "Zombie",
      description: "A rotting corpse that shambles toward you, its dead eyes fixed on your living flesh.",
      reactionDescription:
        "The zombie's decaying flesh tears away where you struck it, but it seems unfazed, its hollow eyes now locked onto you with singular purpose.",
      secondReactionDescription:
        "The zombie's body begins to fall apart, chunks of rotting flesh sloughing off with each movement, yet it continues forward with unnatural determination.",
    },
    {
      name: "Kobold",
      description: "A small reptilian humanoid with scales and a snout. It wields a small spear.",
      reactionDescription:
        "The kobold shrieks in its strange language, its scales bristling as it adopts a more defensive stance with its spear.",
      secondReactionDescription:
        "The kobold's eyes narrow to slits as it begins a rhythmic chanting, its movements becoming more coordinated and tactical with each passing moment.",
    },
    {
      name: "Ghoul",
      description: "A pale, emaciated creature with long claws and teeth. It reeks of decay.",
      reactionDescription:
        "The ghoul's eyes burn with a feverish hunger as it howls in pain, its movements becoming more frenzied and desperate.",
      secondReactionDescription:
        "The ghoul's skin begins to split in places, revealing blackened muscle beneath as it emits a bone-chilling wail that echoes through the dungeon.",
    },
    // New monster types
    {
      name: "Mimic",
      description: "What appeared to be a treasure chest suddenly sprouts teeth and a long, sticky tongue.",
      reactionDescription:
        "The mimic's wooden exterior cracks as it takes damage, revealing glistening, muscular tissue underneath.",
      secondReactionDescription:
        "The mimic's form becomes increasingly unstable, morphing and shifting as it tries to adapt to your attacks.",
    },
    {
      name: "Wraith",
      description: "A translucent, spectral figure hovers before you, its hollow eyes filled with ancient malice.",
      reactionDescription:
        "The wraith's form wavers as your weapon passes through it, emitting a bone-chilling wail that seems to come from everywhere at once.",
      secondReactionDescription:
        "The wraith begins to split into multiple shadowy tendrils that reach out toward you, its form becoming more chaotic and unpredictable.",
    },
    {
      name: "Troll",
      description: "A hulking, green-skinned brute with regenerative abilities and a terrible smell.",
      reactionDescription:
        "The troll roars in pain, its wounds visibly closing even as you watch. It swings its massive fists with renewed fury.",
      secondReactionDescription:
        "The troll enters a berserk rage, its eyes glowing red as it pounds its chest and charges forward with reckless abandon.",
    },
    {
      name: "Basilisk",
      description:
        "A reptilian creature with scales that shimmer with an unnatural light. Its gaze is unnervingly focused.",
      reactionDescription:
        "The basilisk hisses in pain, its scales hardening and changing color as it prepares a more defensive stance.",
      secondReactionDescription:
        "The basilisk's eyes begin to glow with an eerie light, and the air around it seems to waver and distort as it channels its petrifying power.",
    },
    {
      name: "Harpy",
      description:
        "A creature with the upper body of a woman and the wings and lower body of a vulture. Its shriek is deafening.",
      reactionDescription:
        "The harpy takes to the air with a powerful beat of its wings, circling above you and preparing to dive.",
      secondReactionDescription:
        "The harpy's shriek rises to an unbearable pitch as it dives and weaves around you, its talons extended for a killing blow.",
    },
    {
      name: "Gelatinous Cube",
      description:
        "A perfect cube of transparent jelly that fills the corridor, with half-dissolved remains visible inside it.",
      reactionDescription:
        "The cube quivers and contracts where you struck it, its transparent body becoming cloudy with internal damage.",
      secondReactionDescription:
        "The cube begins to split and reform, parts of it reaching out to engulf you while its acidic interior bubbles more violently.",
    },
    {
      name: "Banshee",
      description: "A spectral woman with long, flowing hair and a face frozen in eternal sorrow.",
      reactionDescription:
        "The banshee's mournful wail intensifies, the sound seeming to pierce directly into your mind rather than your ears.",
      secondReactionDescription:
        "The banshee's form becomes increasingly insubstantial, her features distorting with rage as she prepares her most devastating attack.",
    },
    {
      name: "Gargoyle",
      description: "What you thought was a stone statue suddenly moves, spreading its wings and baring stone fangs.",
      reactionDescription:
        "Chips of stone fly as your weapon connects, revealing a core of living tissue beneath the gargoyle's rocky exterior.",
      secondReactionDescription:
        "The gargoyle's movements become more fluid as its stone skin cracks away, revealing a faster, more dangerous creature beneath.",
    },
  ]

  // Available room descriptions - expanded with 30 more unique descriptions
  const availableRoomDescriptions = [
    "You're in a damp chamber with moss-covered walls.",
    "This room has ancient runes carved into the stone floor.",
    "Cobwebs hang from the ceiling of this dusty chamber.",
    "A cold draft blows through this dimly lit room.",
    "The echoes of dripping water fill this cavernous space.",
    "Faded tapestries hang on the walls of this once-grand hall.",
    "This small alcove smells of earth and decay.",
    "Broken pottery litters the floor of this abandoned room.",
    "Flickering shadows dance across the walls of this eerie chamber.",
    "The stone floor is cracked and uneven beneath your feet.",
    "Rusted chains hang from hooks embedded in the ceiling.",
    "A faint humming sound emanates from somewhere within the walls.",
    "Strange fungi grow in patches along the base of the walls.",
    "The remains of a campfire lie in the center of this room.",
    "Ancient weapons hang on display, covered in centuries of dust.",
    "Faded murals depicting epic battles adorn the walls.",
    "The air here is thick with the scent of old incense.",
    "Scattered bones of small animals crunch beneath your feet.",
    "A broken statue of some forgotten deity stands in the corner.",
    "Water has pooled in the low spots of this slanted chamber.",
    // 10 new room descriptions
    "Glowing crystals embedded in the walls cast an eerie blue light across the room.",
    "This chamber appears to have been a library once, with rotting bookshelves lining the walls.",
    "The ceiling of this room is unusually high, disappearing into darkness above.",
    "Strange symbols are etched into the floor, forming a perfect circle in the center.",
    "A small underground stream cuts through one corner of this rocky chamber.",
    "The walls here are warm to the touch, suggesting some heat source nearby.",
    "This appears to be an old dining hall, with a long table still standing despite the years.",
    "Colorful mushrooms grow in clusters, giving off a faint phosphorescent glow.",
    "The remnants of what seems to be an alchemist's laboratory fill this room with strange odors.",
    "This chamber was once ornately decorated, with faded gold leaf still visible on some surfaces.",
    // 10 additional new room descriptions
    "Ancient stone pillars rise from floor to ceiling, covered in mysterious carvings.",
    "The floor is littered with broken glass from what appears to be shattered potion bottles.",
    "A faint magical hum resonates from a cracked crystal orb in the corner of the room.",
    "Tattered banners bearing an unfamiliar crest hang from rusted brackets on the walls.",
    "The ceiling has partially collapsed, allowing a thin shaft of light to penetrate the darkness.",
    "This room appears to have been a guard post, with abandoned weapon racks along one wall.",
    "Charred scorch marks radiate outward from the center of the room, evidence of some magical catastrophe.",
    "The walls are lined with small alcoves, each containing a different unidentifiable artifact.",
    "A large stone altar dominates the center of this room, its surface stained with ancient offerings.",
    "The floor is covered in a thin layer of ash that swirls around your feet as you move.",
    // 30 additional new room descriptions
    "Massive tree roots have broken through the ceiling and walls, creating a natural canopy overhead.",
    "This chamber appears to be a forgotten armory, with rusted weapon racks lining the walls.",
    "The floor is covered in a mosaic depicting an ancient battle between gods and demons.",
    "Stalactites hang from the ceiling like stone daggers, occasionally dripping water.",
    "This appears to be an old torture chamber, with ominous devices still bolted to the floor.",
    "The walls of this room are covered in scratches, as if something tried desperately to escape.",
    "A faint melody seems to emanate from the very stones of this chamber, growing louder as you move deeper.",
    "This room contains what appears to be a shrine to some forgotten deity, with offerings still laid out.",
    "The ceiling of this chamber is covered in luminescent fungi, casting a soft green glow.",
    "Ancient machinery of unknown purpose fills this room, gears and levers frozen with age.",
    "This chamber appears to have been a bathhouse once, with cracked stone pools built into the floor.",
    "The walls here are lined with niches containing the skeletal remains of long-dead inhabitants.",
    "A massive stone face is carved into one wall, its eyes seeming to follow your movements.",
    "This room contains rows of stone benches facing a raised platform, like an ancient classroom.",
    "The floor here is unnaturally warm, and steam rises from cracks between the stone tiles.",
    "Massive chains hang from the ceiling, each link as thick as your arm, their purpose unknown.",
    "This chamber appears to have been a treasury, with empty display pedestals and broken lockboxes.",
    "The walls of this room are covered in frescoes depicting strange rituals and ceremonies.",
    "A circle of standing stones occupies the center of this chamber, each covered in glowing runes.",
    "This room contains what appears to be a massive loom, with threads of unusual colors still strung.",
    "The floor is covered in a fine, glittering dust that swirls around your feet as you move.",
    "This chamber contains rows of stone sarcophagi, their lids thankfully still in place.",
    "The walls here are made of a strange, smooth material unlike the stone in the rest of the dungeon.",
    "A large sundial occupies the center of this room, though no sunlight reaches this deep.",
    "This chamber appears to have been a nursery, with small beds and toys now covered in dust.",
    "The air in this room tastes metallic, and small objects seem to float slightly above surfaces.",
    "This appears to be an ancient kitchen, with massive hearths and rusted cooking implements.",
    "The walls of this chamber are covered in mirrors, most cracked or tarnished beyond use.",
    "A massive skeleton of some unknown creature is embedded in one wall, partially excavated.",
    "This room contains a pool of still, black water that reflects nothing, not even light.",
  ]

  // Add an effect to reveal the entire map when the game ends
  useEffect(() => {
    if (gameStatus === "won" || gameStatus === "lost") {
      // Reveal the entire map
      setVisitedTiles(
        Array(dungeonSize)
          .fill(null)
          .map(() => Array(dungeonSize).fill(true)),
      )
    }
  }, [gameStatus, dungeonSize])

  // Helper function to apply difficulty settings based on Rogue Run state
  const applyRogueRunDifficultySettings = (currentRogueRun: RogueRunState) => {
    // Get the base settings for the current difficulty
    const baseSettings = DIFFICULTY_SETTINGS[currentRogueRun.difficulty]

    // Apply the settings
    setDungeonSize(baseSettings.size)
    setEnemyCount(baseSettings.enemyCount + currentRogueRun.extraMonsters)
    setPotionCount(baseSettings.potionCount)
    setWallMultiplier(baseSettings.wallMultiplier)

    console.log(
      `Applied Rogue Run settings: Round ${currentRogueRun.round}, Difficulty ${currentRogueRun.difficulty}, Size ${baseSettings.size}, Enemies ${baseSettings.enemyCount + currentRogueRun.extraMonsters}`,
    )
  }

  // Function to start the game with the selected difficulty
  const startGame = () => {
    setGameStarted(true)

    if (difficulty === "roguerun") {
      // Initialize Rogue Run with round 1, normal difficulty
      const initialRogueRun: RogueRunState = {
        active: true,
        round: 1,
        difficulty: "normal",
        extraMonsters: 0,
        pendingNextRound: false,
      }

      setRogueRun(initialRogueRun)

      // Apply normal difficulty settings
      applyRogueRunDifficultySettings(initialRogueRun)

      addToGameLog("Rogue Run started! Round 1 - Normal difficulty.")
    } else {
      // For non-Rogue Run games, just use the selected difficulty
      setRogueRun({
        active: false,
        round: 0,
        difficulty: "normal",
        extraMonsters: 0,
        pendingNextRound: false,
      })
    }

    // Force a small delay to ensure state updates before initializing
    setTimeout(() => {
      initializeGame()
    }, 100)
  }

  // Function to announce player status
  const announcePlayerStatus = () => {
    const statusMessage = `Your status: Health: ${player.health}/100, Attack: ${player.attack}, ${
      hasKey ? "You have the key" : "You don't have the key yet"
    }.`

    // Update the live region for screen readers
    if (announcementRef.current) {
      announcementRef.current.textContent = statusMessage
    }

    // Add to game log
    addToGameLog(statusMessage)
  }

  // Function to repeat the current location description
  const announceCurrentLocation = () => {
    if (currentLocationDescription) {
      // Update the live region for screen readers
      if (announcementRef.current) {
        announcementRef.current.textContent = currentLocationDescription
      }

      // Add to game log
      addToGameLog("You look around again...")
      addToGameLog(currentLocationDescription)
    } else {
      // If no description is stored yet, describe the current position
      describeCurrentPosition(player.position.x, player.position.y)
    }
  }

  // Add this function after the announceCurrentLocation function
  const announceMapOverview = () => {
    // Count revealed squares
    const totalSquares = dungeonSize * dungeonSize
    let revealedSquares = 0
    visitedTiles.forEach((row) => {
      row.forEach((tile) => {
        if (tile) revealedSquares++
      })
    })

    // Count visible monsters and their locations
    const visibleMonsters = entities.filter(
      (e) => e.type === "enemy" && visitedTiles[e.position.y] && visitedTiles[e.position.y][e.position.x],
    )

    // Count visible potions
    const visiblePotions = entities.filter(
      (e) => e.type === "health" && visitedTiles[e.position.y] && visitedTiles[e.position.y][e.position.x],
    )

    // Build monster locations string
    let monsterLocations = ""
    if (visibleMonsters.length > 0) {
      monsterLocations = visibleMonsters
        .map((monster) => `${monster.monsterType} at column ${monster.position.x + 1}, row ${monster.position.y + 1}`)
        .join("; ")
    }

    // Create the overview message
    const overviewMessage = `Map overview: 
      Grid size: ${dungeonSize}×${dungeonSize}. 
      Your position: column ${player.position.x + 1}, row ${player.position.y + 1}. 
      Revealed squares: ${revealedSquares} out of ${totalSquares}. 
      Visible monsters: ${visibleMonsters.length}${visibleMonsters.length > 0 ? ". " + monsterLocations : ""}. 
      Visible potions: ${visiblePotions.length}.
      ${rogueRun.active ? `Current Rogue Run round: ${rogueRun.round}` : ""}
    `

    // Update the live region for screen readers
    if (announcementRef.current) {
      announcementRef.current.textContent = overviewMessage
    }

    // Add to game log
    addToGameLog(overviewMessage)
  }

  // Update the movePlayer function to handle monster encounters with encounter count
  const movePlayer = useCallback(
    (dx: number, dy: number) => {
      // Prevent multiple moves from being processed simultaneously
      if (moveInProgress.current) return
      moveInProgress.current = true

      setPlayer((currentPlayer) => {
        const newX = currentPlayer.position.x + dx
        const newY = currentPlayer.position.y + dy

        // Check if the move is valid
        if (newX < 0 || newX >= dungeonSize || newY < 0 || newY >= dungeonSize) {
          addToGameLog("You can't move outside the dungeon!")
          // Release the move lock after a short delay
          setTimeout(() => {
            moveInProgress.current = false
          }, 100)
          return currentPlayer // Return unchanged player
        }

        // Safety check - if gameMap isn't initialized yet, return unchanged player
        if (!gameMap || !gameMap.length || !gameMap[newY] || gameMap[newY][newX] === undefined) {
          // Release the move lock after a short delay
          setTimeout(() => {
            moveInProgress.current = false
          }, 100)
          return currentPlayer // Return unchanged player
        }

        // Get current game map
        const currentMap = [...gameMap]

        // Check what's in the target position
        const targetTile = currentMap[newY][newX]

        if (targetTile === "#") {
          addToGameLog("You bump into a wall.")

          // Mark the wall as visited so it appears on the map
          setVisitedTiles((prev) => {
            if (!prev || !prev.length || !prev[newY]) return prev

            const newVisited = [...prev]
            if (newVisited[newY] && newX >= 0 && newX < newVisited[newY].length) {
              newVisited[newY][newX] = true
            }
            return newVisited
          })

          // Release the move lock after a short delay
          setTimeout(() => {
            moveInProgress.current = false
          }, 100)
          return currentPlayer // Return unchanged player
        }

        // Mark the tile as visited regardless of what's there
        // This ensures monsters and exits are visible on the map
        setVisitedTiles((prev) => {
          if (!prev || !prev.length || !prev[newY]) return prev

          const newVisited = [...prev]
          if (newVisited[newY] && newX >= 0 && newX < newVisited[newY].length) {
            newVisited[newY][newX] = true
          }
          return newVisited
        })

        // Update the void handling in movePlayer function
        if (targetTile === "V") {
          // Player fell into the void
          addToGameLog("You step forward and the floor gives way beneath you! You fall into a bottomless void...")

          if (rogueRun.active) {
            // In Rogue Run, falling into the void is game over
            setTimeout(() => {
              handleRogueRunGameOver("You fell into the void!")
            }, 1000)
          } else {
            // Regular game - reset
            setTimeout(() => {
              addToGameLog(
                "As you fall through darkness, you lose consciousness. When you awaken, you find yourself back at the entrance to the dungeon. The game has reset.",
              )
            }, 1000)

            // Reset the game after a short delay
            setTimeout(() => {
              setGameStatus("playing")
              setGameLog([])
              initializeGame()
            }, 3000)
          }

          // Release the move lock after a short delay
          setTimeout(() => {
            moveInProgress.current = false
          }, 100)

          return currentPlayer // Return unchanged player
        }

        if (targetTile === "M") {
          // Find the enemy at this position
          const enemy = entities.find((e) => e.type === "enemy" && e.position.x === newX && e.position.y === newY)

          if (enemy && enemy.health) {
            // Track monster encounters using the monster's ID
            setMonsterEncounters((prev) => {
              const newEncounters = { ...prev }
              newEncounters[enemy.id] = (newEncounters[enemy.id] || 0) + 1

              // Show description based on encounter count
              const encounterCount = newEncounters[enemy.id]

              if (encounterCount === 1) {
                // First encounter - show basic description
                addToGameLog(`You encounter a ${enemy.monsterType}. ${enemy.description}`)
              } else if (encounterCount === 2) {
                // Second encounter - show first reaction
                addToGameLog(`You encounter a ${enemy.monsterType}. ${enemy.reactionDescription}`)
              } else {
                // Third or more encounter - show second reaction
                addToGameLog(`You encounter a ${enemy.monsterType}. ${enemy.secondReactionDescription}`)
              }

              return newEncounters
            })

            // Handle combat in the next tick to ensure state updates properly
            setTimeout(() => {
              handleCombat(enemy)
              moveInProgress.current = false
            }, 100)

            return currentPlayer // Return unchanged player
          }
        }

        if (targetTile === "H") {
          // Collect health potion
          const potion = entities.find((e) => e.type === "health" && e.position.x === newX && e.position.y === newY)

          if (potion) {
            collectHealthPotion(potion, currentPlayer)
            // Release the move lock after a short delay
            setTimeout(() => {
              moveInProgress.current = false
            }, 100)
            return {
              ...currentPlayer,
              position: { x: newX, y: newY },
              health: Math.min(100, (currentPlayer.health || 0) + 30),
            }
          }
        }

        if (targetTile === "K") {
          // Collect key
          const key = entities.find((e) => e.type === "key" && e.position.x === newX && e.position.y === newY)

          if (key) {
            collectKey(key, currentPlayer)
            // Release the move lock after a short delay
            setTimeout(() => {
              moveInProgress.current = false
            }, 100)
            return {
              ...currentPlayer,
              position: { x: newX, y: newY },
            }
          }
        }

        // Update the exit handling in movePlayer
        if (targetTile === "E") {
          // Reached the exit
          // Mark the exit as discovered
          setEntities((prev) =>
            prev.map((entity) => (entity.type === "exit" ? { ...entity, discovered: true } : entity)),
          )

          if (hasKey) {
            if (rogueRun.active) {
              handleRogueRunVictory()
            } else {
              setGameStatus("won")
              addToGameLog(
                "You use the key to unlock the door. Congratulations! You escaped the dungeon! Press Enter to play again, or press Tab then Enter to Change Difficulty.",
              )
            }
          } else {
            addToGameLog("The exit door is locked. You need to find a key to unlock it.")
          }
          // Release the move lock after a short delay
          setTimeout(() => {
            moveInProgress.current = false
          }, 100)
          return currentPlayer // Return unchanged player
        }

        // Update map - clear old position and set new position
        if (
          currentPlayer.position.y >= 0 &&
          currentPlayer.position.y < currentMap.length &&
          currentPlayer.position.x >= 0 &&
          currentPlayer.position.x < currentMap[currentPlayer.position.y].length
        ) {
          currentMap[currentPlayer.position.y][currentPlayer.position.x] = "."
        }

        if (newY >= 0 && newY < currentMap.length && newX >= 0 && newX < currentMap[newY].length) {
          currentMap[newY][newX] = "P"
        }

        setGameMap(currentMap)

        // Describe the new position
        describeCurrentPosition(newX, newY)

        // Release the move lock after a short delay
        setTimeout(() => {
          moveInProgress.current = false
        }, 100)

        // Return updated player
        return {
          ...currentPlayer,
          position: { x: newX, y: newY },
        }
      })
    },
    [gameMap, entities, hasKey, dungeonSize, rogueRun],
  )

  // Set up keyboard event listeners
  useEffect(() => {
    // Function to handle keyboard events
    const handleKeyboardMovement = (e: KeyboardEvent) => {
      if (!gameStarted) return

      // Special case for Enter key when waiting to continue to next round
      if (e.key === "Enter" && rogueRun.pendingNextRound) {
        e.preventDefault()
        console.log("Enter key pressed to continue to next round")
        startNextRogueRunRound()
        return
      }

      // Don't process other keys if game is not in playing state
      if (gameStatus !== "playing") return

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault() // Prevent page scrolling
          movePlayer(0, -1)
          break
        case "ArrowDown":
          e.preventDefault() // Prevent page scrolling
          movePlayer(0, 1)
          break
        case "ArrowLeft":
          e.preventDefault() // Prevent page scrolling
          movePlayer(-1, 0)
          break
        case "ArrowRight":
          e.preventDefault() // Prevent page scrolling
          movePlayer(1, 0)
          break
        case "s":
        case "S":
          e.preventDefault()
          announcePlayerStatus()
          break
        case "l":
        case "L":
          e.preventDefault()
          announceCurrentLocation()
          break
        case "m":
        case "M":
          e.preventDefault()
          announceMapOverview()
          break
      }
    }

    // Add keyboard event listeners
    window.addEventListener("keydown", handleKeyboardMovement)

    // Clean up event listeners
    return () => {
      window.removeEventListener("keydown", handleKeyboardMovement)
    }
  }, [gameStatus, movePlayer, gameStarted, rogueRun])

  // Scroll game log to bottom when updated
  useEffect(() => {
    if (gameLogEndRef.current) {
      // Only scroll the game log element itself, not the entire page
      gameLogEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
    }
  }, [gameLog])

  // Get a non-repeating room description
  const getNonRepeatingRoomDescription = () => {
    // Filter out descriptions that have already been used
    const unusedDescriptions = availableRoomDescriptions.filter((desc) => !usedRoomDescriptions.has(desc))

    // If we've used all descriptions, reset the used set and use any description
    if (unusedDescriptions.length === 0) {
      setUsedRoomDescriptions(new Set())
      return availableRoomDescriptions[Math.floor(Math.random() * availableRoomDescriptions.length)]
    }

    // Get a random unused description
    const description = unusedDescriptions[Math.floor(Math.random() * unusedDescriptions.length)]

    // Mark it as used
    setUsedRoomDescriptions((prev) => new Set([...prev, description]))

    return description
  }

  // Add the flood fill helper function
  const floodFill = (map: string[][], x: number, y: number) => {
    // Check boundaries
    if (y < 0 || y >= map.length || x < 0 || x >= map[y].length) {
      return
    }

    // Check if this is a wall, void, exit door, or already visited
    if (map[y][x] === "#" || map[y][x] === "V" || map[y][x] === "E" || map[y][x] === "X") {
      return
    }

    // Mark as visited
    map[y][x] = "X"

    // Recursively fill in all four directions
    floodFill(map, x + 1, y) // right
    floodFill(map, x - 1, y) // left
    floodFill(map, x, y + 1) // down
    floodFill(map, x, y - 1) // up
  }

  // Improved function to check if all spaces are accessible
  const checkAllSpacesAccessible = (map: string[][]) => {
    // Create a copy of the map for flood fill
    const mapCopy = map.map((row) => [...row])

    // Find player position (or any starting point)
    let startX = 0,
      startY = 0
    for (let y = 0; y < mapCopy.length; y++) {
      for (let x = 0; x < mapCopy[y].length; x++) {
        if (mapCopy[y][x] === "P") {
          startX = x
          startY = y
          break
        }
      }
    }

    // Perform flood fill from player position
    floodFill(mapCopy, startX, startY)

    // Check if any empty spaces remain unreached
    for (let y = 0; y < mapCopy.length; y++) {
      for (let x = 0; x < mapCopy[y].length; x++) {
        // If there's an empty space, key, health potion, or monster that wasn't reached
        if ([".", "K", "H", "M"].includes(mapCopy[y][x])) {
          return false // Found an unreachable space
        }
      }
    }

    // Additional check: Make sure player has at least two valid moves
    let validMoveCount = 0
    const directions = [
      { x: 0, y: -1 }, // up
      { x: 1, y: 0 }, // right
      { x: 0, y: 1 }, // down
      { x: -1, y: 0 }, // left
    ]

    for (const dir of directions) {
      const nx = startX + dir.x
      const ny = startY + dir.y

      if (
        nx >= 0 &&
        nx < dungeonSize &&
        ny >= 0 &&
        ny < dungeonSize &&
        map[ny][nx] !== "#" &&
        map[ny][nx] !== "V" &&
        map[ny][nx] !== "E"
      ) {
        validMoveCount++
      }
    }

    return validMoveCount >= 2 // Player must have at least 2 valid moves
  }

  // Improved pathfinding function to check if a path exists between two points
  const isPathPossible = (map: string[][], start: Position, end: Position) => {
    // Create a copy of the map for pathfinding
    const mapCopy = map.map((row) => [...row])

    // Mark walls, void, and exit doors as visited to avoid them in pathfinding
    // Exception: If the exit door is the destination, don't mark it as visited
    for (let y = 0; y < mapCopy.length; y++) {
      for (let x = 0; x < mapCopy[y].length; x++) {
        if (mapCopy[y][x] === "#" || mapCopy[y][x] === "V" || (mapCopy[y][x] === "E" && (end.x !== x || end.y !== y))) {
          mapCopy[y][x] = "X" // Mark as visited/blocked
        }
      }
    }

    // Queue for BFS
    const queue: Position[] = [start]
    // Mark start as visited
    mapCopy[start.y][start.x] = "X"

    // Directions: up, right, down, left
    const directions = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ]

    while (queue.length > 0) {
      const current = queue.shift()!

      // Check if we reached the end
      if (current.x === end.x && current.y === end.y) {
        return true
      }

      // Try all four directions
      for (const dir of directions) {
        const newX = current.x + dir.x
        const newY = current.y + dir.y

        // Check if the new position is valid
        if (
          newX >= 0 &&
          newX < mapCopy[0].length &&
          newY >= 0 &&
          newY < mapCopy.length &&
          mapCopy[newY][newX] !== "X"
        ) {
          // Mark as visited and add to queue
          mapCopy[newY][newX] = "X"
          queue.push({ x: newX, y: newY })
        }
      }
    }

    // If we've exhausted all possibilities without finding the end
    return false
  }

  // Additional check to ensure no spaces are isolated
  const checkNoIsolatedSpaces = (map: string[][]) => {
    // Check each empty space, key, health potion, and monster
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        // Only check non-wall, non-void, non-exit spaces
        if ([".", "K", "H", "M", "P"].includes(map[y][x])) {
          // Count accessible neighbors
          let accessibleNeighbors = 0

          // Check all four directions
          if (y > 0 && map[y - 1][x] !== "#" && map[y - 1][x] !== "V" && map[y - 1][x] !== "E") accessibleNeighbors++
          if (y < map.length - 1 && map[y + 1][x] !== "#" && map[y + 1][x] !== "V" && map[y + 1][x] !== "E")
            accessibleNeighbors++
          if (x > 0 && map[y][x - 1] !== "#" && map[y][x - 1] !== "V" && map[y][x - 1] !== "E") accessibleNeighbors++
          if (x < map[y].length - 1 && map[y][x + 1] !== "#" && map[y][x + 1] !== "V" && map[y][x + 1] !== "E")
            accessibleNeighbors++

          // If a space has no accessible neighbors, it's isolated
          if (accessibleNeighbors === 0) {
            return false
          }
        }
      }
    }
    return true
  }

  // Enhanced check for exit accessibility
  const ensureExitAccessible = (map: string[][], exitPos: Position) => {
    // Check if the exit has at least one accessible neighbor
    let accessibleNeighbors = 0

    // Check all four directions
    if (exitPos.y > 0 && map[exitPos.y - 1][exitPos.x] !== "#" && map[exitPos.y - 1][exitPos.x] !== "V")
      accessibleNeighbors++
    if (exitPos.y < map.length - 1 && map[exitPos.y + 1][exitPos.x] !== "#" && map[exitPos.y + 1][exitPos.x] !== "V")
      accessibleNeighbors++
    if (exitPos.x > 0 && map[exitPos.y][exitPos.x - 1] !== "#" && map[exitPos.y][exitPos.x - 1] !== "V")
      accessibleNeighbors++
    if (exitPos.x < map[0].length - 1 && map[exitPos.y][exitPos.x + 1] !== "#" && map[exitPos.y][exitPos.x + 1] !== "V")
      accessibleNeighbors++

    return accessibleNeighbors > 0
  }

  // Update the initializeGame function to ensure solvable dungeons
  const initializeGame = (forcedDungeonSize?: number) => {
    // Prevent multiple initializations from running simultaneously
    if (mapGenerationInProgress.current) {
      console.log("Map generation already in progress, skipping")
      return
    }

    mapGenerationInProgress.current = true

    // Use the forced dungeon size if provided, otherwise use the state value
    const effectiveDungeonSize = forcedDungeonSize !== undefined ? forcedDungeonSize : dungeonSize

    console.log(`Starting map generation with size: ${effectiveDungeonSize}`)

    // Log current state for debugging
    console.log(`Initializing game with dungeonSize: ${effectiveDungeonSize}, enemyCount: ${enemyCount}`)

    if (rogueRun.active) {
      console.log(`Rogue Run state: Round ${rogueRun.round}, Difficulty ${rogueRun.difficulty}`)
    }

    let validDungeonFound = false
    let newMap: string[][] = []
    let newRoomDescriptions: RoomDescription[][] = []
    let playerPos: Position = { x: 0, y: 0 }
    let exitPos: Position = { x: 0, y: 0 }
    let keyPos: Position = { x: 0, y: 0 }
    let voidPos: Position | null = null
    let newEntities: Entity[] = []
    const includeVoid = Math.random() < VOID_CHANCE

    // Add this debug log
    console.log(`Void square included in this map: ${includeVoid}`)

    setHasVoid(includeVoid)

    // Keep generating dungeons until we find a valid one
    let attempts = 0
    const maxAttempts = 150 // Increased max attempts

    while (!validDungeonFound && attempts < maxAttempts) {
      attempts++

      // Create empty map with the effective dungeon size
      newMap = Array(effectiveDungeonSize)
        .fill(null)
        .map(() => Array(effectiveDungeonSize).fill("."))

      // Initialize room descriptions
      newRoomDescriptions = Array(effectiveDungeonSize)
        .fill(null)
        .map(() =>
          Array(effectiveDungeonSize)
            .fill(null)
            .map(() => ({
              description: getNonRepeatingRoomDescription(),
              visited: false,
            })),
        )

      // Place player at starting position
      playerPos = { x: 0, y: 0 }
      newMap[playerPos.y][playerPos.x] = "P"
      newRoomDescriptions[playerPos.y][playerPos.x].visited = true

      // Place exit at a random position (not the starting position)
      // For better gameplay, place exit farther from the player but within the grid bounds
      do {
        exitPos = {
          x: Math.min(
            Math.floor(Math.random() * (effectiveDungeonSize / 2)) + Math.floor(effectiveDungeonSize / 2),
            effectiveDungeonSize - 1,
          ),
          y: Math.min(
            Math.floor(Math.random() * (effectiveDungeonSize / 2)) + Math.floor(effectiveDungeonSize / 2),
            effectiveDungeonSize - 1,
          ),
        }
      } while (exitPos.x === playerPos.x && exitPos.y === playerPos.y)

      newMap[exitPos.y][exitPos.x] = "E"

      newEntities = [
        {
          id: "exit",
          position: exitPos,
          type: "exit",
          description: "The exit door to the dungeon. It appears to be locked.",
          discovered: false,
        },
      ]

      // Place key at a random position (not the starting position or exit)
      // For better gameplay, place key at a medium distance from player
      do {
        keyPos = {
          x: Math.floor(Math.random() * effectiveDungeonSize),
          y: Math.floor(Math.random() * effectiveDungeonSize),
        }
      } while (
        (keyPos.x === playerPos.x && keyPos.y === playerPos.y) ||
        (keyPos.x === exitPos.x && keyPos.y === exitPos.y) ||
        // Ensure key isn't too close to player
        Math.abs(keyPos.x - playerPos.x) + Math.abs(keyPos.y - playerPos.y) < Math.floor(effectiveDungeonSize / 3)
      )

      newMap[keyPos.y][keyPos.x] = "K"

      newEntities.push({
        id: "key",
        position: keyPos,
        type: "key",
        description: "A rusty key that might unlock the exit door.",
      })

      // Place void if enabled (not at player, exit, or key positions)
      if (includeVoid) {
        do {
          voidPos = {
            x: Math.floor(Math.random() * effectiveDungeonSize),
            y: Math.floor(Math.random() * effectiveDungeonSize),
          }
        } while (
          (voidPos.x === playerPos.x && voidPos.y === playerPos.y) ||
          (voidPos.x === exitPos.x && voidPos.y === exitPos.y) ||
          (voidPos.x === keyPos.x && voidPos.y === keyPos.y) ||
          // Ensure void isn't too close to player
          Math.abs(voidPos.x - playerPos.x) + Math.abs(voidPos.y - playerPos.y) < 3
        )

        newMap[voidPos.y][voidPos.x] = "V"

        newEntities.push({
          id: "void",
          position: voidPos,
          type: "void",
          description: "A dark hole in the floor. It seems to go down forever.",
        })
      }

      // Calculate number of walls based on dungeon size and difficulty
      // Significantly reduce wall multiplier to make dungeons more open
      const adjustedWallMultiplier = wallMultiplier * 0.6 // Reduced from 0.8 to 0.6
      const wallCount = Math.floor(effectiveDungeonSize * adjustedWallMultiplier)

      // Place walls to make the dungeon more challenging, but ensure all spaces remain accessible
      for (let i = 0; i < wallCount; i++) {
        let validWallPlaced = false
        let wallAttempts = 0
        const maxWallAttempts = 25 // Increased from 20 to 25

        while (!validWallPlaced && wallAttempts < maxWallAttempts) {
          wallAttempts++
          const pos = getRandomEmptyPosition(newMap, effectiveDungeonSize)

          // Don't place walls too close to the player's starting position
          if (Math.abs(pos.x - playerPos.x) + Math.abs(pos.y - playerPos.y) < 2) {
            continue
          }

          // Temporarily place the wall
          const originalTile = newMap[pos.y][pos.x]
          newMap[pos.y][pos.x] = "#"

          // Check if all empty spaces are still reachable from the player position
          const allSpacesAccessible = checkAllSpacesAccessible(newMap)

          // Additional check for isolated spaces
          const noIsolatedSpaces = checkNoIsolatedSpaces(newMap)

          // Check if exit is still accessible
          const exitAccessible = ensureExitAccessible(newMap, exitPos)

          // Check paths to key and exit
          const playerToKey = isPathPossible(newMap, playerPos, keyPos)
          const keyToExit = isPathPossible(newMap, keyPos, exitPos)

          if (allSpacesAccessible && noIsolatedSpaces && exitAccessible && playerToKey && keyToExit) {
            // Wall placement is valid, add it to entities
            newEntities.push({
              id: `wall-${i}`,
              position: pos,
              type: "wall",
              description: "A solid stone wall blocking your path",
            })
            validWallPlaced = true
          } else {
            // Revert the wall placement
            newMap[pos.y][pos.x] = originalTile
          }
        }

        // If we couldn't place a valid wall after max attempts, just continue
        if (!validWallPlaced) {
          console.log(`Couldn't place wall ${i} after ${maxWallAttempts} attempts`)
        }
      }

      // 4. Add additional validation steps to ensure no player can get trapped
      // Check if there's a path from player to key and from key to exit
      const playerToKey = isPathPossible(newMap, playerPos, keyPos)
      const keyToExit = isPathPossible(newMap, keyPos, exitPos)

      // Check if all spaces are accessible (treating exit as a wall)
      const allSpacesAccessible = checkAllSpacesAccessible(newMap)

      // Check for isolated spaces
      const noIsolatedSpaces = checkNoIsolatedSpaces(newMap)

      // Check if exit is accessible
      const exitAccessible = ensureExitAccessible(newMap, exitPos)

      // Check that player has at least 2 valid moves
      let playerValidMoves = 0
      const directions = [
        { x: 0, y: -1 }, // up
        { x: 1, y: 0 }, // right
        { x: 0, y: 1 }, // down
        { x: -1, y: 0 }, // left
      ]

      for (const dir of directions) {
        const nx = playerPos.x + dir.x
        const ny = playerPos.y + dir.y
        if (
          nx >= 0 &&
          nx < effectiveDungeonSize &&
          ny >= 0 &&
          ny < effectiveDungeonSize &&
          newMap[ny] && // Add this safety check
          newMap[ny][nx] !== "#" &&
          newMap[ny][nx] !== "V" &&
          newMap[ny][nx] !== "E"
        ) {
          playerValidMoves++
        }
      }

      // Final validation - all conditions must be met
      if (
        playerToKey &&
        keyToExit &&
        allSpacesAccessible &&
        noIsolatedSpaces &&
        exitAccessible &&
        playerValidMoves >= 2
      ) {
        validDungeonFound = true
      } else {
        // If not valid, we'll loop and try again
        console.log(`Generated an unsolvable dungeon (attempt ${attempts}). Retrying...`)
      }
    }

    // If we couldn't generate a valid dungeon after max attempts, create a simple one
    if (!validDungeonFound) {
      console.log("Failed to generate a valid dungeon after maximum attempts. Creating a simple dungeon.")

      // Create a simple dungeon with minimal walls
      newMap = Array(effectiveDungeonSize)
        .fill(null)
        .map(() => Array(effectiveDungeonSize).fill("."))

      // Place player at starting position
      playerPos = { x: 0, y: 0 }
      newMap[playerPos.y][playerPos.x] = "P"

      // Place exit in the opposite corner
      exitPos = { x: effectiveDungeonSize - 1, y: effectiveDungeonSize - 1 }
      newMap[exitPos.y][exitPos.x] = "E"

      // Place key in the middle
      keyPos = { x: Math.floor(effectiveDungeonSize / 2), y: Math.floor(effectiveDungeonSize / 2) }
      newMap[keyPos.y][keyPos.x] = "K"

      // Update entities
      newEntities = [
        {
          id: "exit",
          position: exitPos,
          type: "exit",
          description: "The exit door to the dungeon. It appears to be locked.",
          discovered: false,
        },
        {
          id: "key",
          position: keyPos,
          type: "key",
          description: "A rusty key that might unlock the exit door.",
        },
      ]
    }

    // Now that we have a valid dungeon, place enemies and health potions
    // Place enemies
    for (let i = 0; i < enemyCount; i++) {
      const pos = getRandomEmptyPosition(newMap, effectiveDungeonSize)

      // Verify this position doesn't trap any squares before placing the monster
      newMap[pos.y][pos.x] = "M"

      // Check if all spaces are still accessible with this monster
      if (!checkAllSpacesAccessible(newMap)) {
        // If this monster placement would trap squares, revert and skip
        newMap[pos.y][pos.x] = "."
        continue
      }

      // Select a random monster type
      const monsterType = monsterTypes[Math.floor(Math.random() * monsterTypes.length)]

      // Assign varied attack power (5, 10, or 20)
      const attackPowers = [5, 10, 20]
      const attackPower = attackPowers[Math.floor(Math.random() * attackPowers.length)]

      // Assign varied health (40, 50, or 60)
      const healthValues = [40, 50, 60]
      const health = healthValues[Math.floor(Math.random() * healthValues.length)]

      newEntities.push({
        id: `enemy-${i}`,
        position: pos,
        type: "enemy",
        health: health,
        originalHealth: health, // Store original health
        attack: attackPower,
        description: monsterType.description,
        reactionDescription: monsterType.reactionDescription,
        secondReactionDescription: monsterType.secondReactionDescription,
        monsterType: monsterType.name,
        hasBeenAttacked: false,
        encounterCount: 0,
      })
    }

    // Place health potions
    for (let i = 0; i < potionCount; i++) {
      const pos = getRandomEmptyPosition(newMap, effectiveDungeonSize)

      // Verify this position doesn't trap any squares before placing the potion
      newMap[pos.y][pos.x] = "H"

      // Check if all spaces are still accessible with this potion
      if (!checkAllSpacesAccessible(newMap)) {
        // If this potion placement would trap squares, revert and skip
        newMap[pos.y][pos.x] = "."
        continue
      }

      newEntities.push({
        id: `health-${i}`,
        position: pos,
        type: "health",
        description: "A health potion that restores 30 health points",
      })
    }

    // Initialize visited tiles array
    const initialVisited = Array(effectiveDungeonSize)
      .fill(null)
      .map(() => Array(effectiveDungeonSize).fill(false))

    // Mark starting position as visited
    initialVisited[0][0] = true

    // Reset key status
    setHasKey(false)

    // Reset current location description
    setCurrentLocationDescription("")

    // Reset monster encounters
    setMonsterEncounters({})

    // Set all state in one go to avoid race conditions
    setGameMap(newMap)
    setEntities(newEntities)
    setVisitedTiles(initialVisited)
    setRoomDescriptions(newRoomDescriptions)
    setPlayer({
      id: "player",
      position: playerPos,
      type: "player",
      health: 100,
      attack: 20,
      description: "You, the brave adventurer",
    })

    // Log successful map generation
    console.log(
      `Map generated successfully: ${effectiveDungeonSize}x${effectiveDungeonSize} grid with ${enemyCount} enemies`,
    )

    // Release the map generation lock
    mapGenerationInProgress.current = false

    // Wait for state to update before describing position
    setTimeout(() => {
      describeCurrentPosition(playerPos.x, playerPos.y)
    }, 300) // Increased timeout to ensure state is updated
  }

  // Get a random empty position on the map
  const getRandomEmptyPosition = (map: string[][], effectiveDungeonSize: number) => {
    let pos: Position
    do {
      pos = {
        x: Math.floor(Math.random() * effectiveDungeonSize),
        y: Math.floor(Math.random() * effectiveDungeonSize),
      }
    } while (map[pos.y][pos.x] !== ".")

    return pos
  }

  // Fixed collectHealthPotion function to avoid player icon duplication
  const collectHealthPotion = (potion: Entity, currentPlayer: Entity) => {
    // Safety check - if gameMap isn't initialized yet, return
    if (!gameMap || !gameMap.length) {
      return
    }

    // Update map - clear old position and set new position
    const newMap = [...gameMap]

    // Safety checks before accessing array indices
    if (
      currentPlayer.position.y >= 0 &&
      currentPlayer.position.y < newMap.length &&
      currentPlayer.position.x >= 0 &&
      currentPlayer.position.x < newMap[currentPlayer.position.y].length
    ) {
      // Clear the old position
      newMap[currentPlayer.position.y][currentPlayer.position.x] = "."
    }

    if (
      potion.position.y >= 0 &&
      potion.position.y < newMap.length &&
      potion.position.x >= 0 &&
      potion.position.x < newMap[potion.position.y].length
    ) {
      // Set the new position
      newMap[potion.position.y][potion.position.x] = "P"
    }

    // Remove potion from entities
    const newEntities = entities.filter((e) => e.id !== potion.id)

    // Mark potion position as visited
    setVisitedTiles((prev) => {
      if (!prev || !prev.length) return prev

      const newVisited = [...prev]
      if (
        potion.position.y >= 0 &&
        potion.position.y < newVisited.length &&
        potion.position.x >= 0 &&
        newVisited[potion.position.y] &&
        potion.position.x < newVisited[potion.position.y].length
      ) {
        newVisited[potion.position.y][potion.position.x] = true
      }
      return newVisited
    })

    setGameMap(newMap)
    setEntities(newEntities)

    // First announce finding the potion - this will be read by the screen reader
    const potionMessage = `You found a health potion! +30 health. Your health: ${Math.min(100, (currentPlayer.health || 0) + 30)}/100`

    // Update the live region for screen readers with the potion message
    if (announcementRef.current) {
      announcementRef.current.textContent = potionMessage
    }

    // Add to game log
    addToGameLog(potionMessage)

    // Then describe the room after collecting the potion
    setTimeout(() => {
      // Safety check for roomDescriptions
      if (!roomDescriptions || !roomDescriptions.length) return

      // Get the room description directly with safety checks
      if (
        potion.position.y >= 0 &&
        potion.position.y < roomDescriptions.length &&
        roomDescriptions[potion.position.y] &&
        potion.position.x >= 0 &&
        potion.position.x < roomDescriptions[potion.position.y].length
      ) {
        const roomDesc = roomDescriptions[potion.position.y][potion.position.x].description
        const surroundings = buildSurroundingsDescription(potion.position.x, potion.position.y)
        const message = `${roomDesc} ${surroundings}.`

        // Store the current location description
        setCurrentLocationDescription(message)

        // Add to game log without updating the screen reader announcement
        setGameLog((prev) => [...prev, message])
      }
    }, 100)
  }

  // Helper function to build surroundings description
  const buildSurroundingsDescription = (x: number, y: number) => {
    // Safety check - if gameMap isn't initialized yet, return empty string
    if (!gameMap || !gameMap.length) {
      return ""
    }

    // Check adjacent tiles
    const adjacentTiles = [
      { dx: 0, dy: -1, dir: "north" },
      { dx: 1, dy: 0, dir: "east" },
      { dx: 0, dy: 1, dir: "south" },
      { dx: -1, dy: 0, dir: "west" },
    ]

    // Group similar passages together
    const passages = {
      open: [] as string[],
      blocked: [] as string[],
      growling: [] as string[],
      glow: [] as string[],
      exit: [] as string[],
      key: [] as string[],
      wall: [] as string[],
      mysterious: [] as string[],
      ancient: [] as string[],
    }

    adjacentTiles.forEach(({ dx, dy, dir }) => {
      const nx = x + dx
      const ny = y + dy

      // Check if we're out of bounds
      if (nx < 0 || nx >= dungeonSize || ny < 0 || ny >= dungeonSize) {
        passages.wall.push(dir)
        return
      }

      // Safety check - make sure the row exists and the column is valid before accessing it
      if (!gameMap[ny] || gameMap[ny][nx] === undefined) {
        return
      }

      const tile = gameMap[ny][nx]
      switch (tile) {
        case "#":
          passages.blocked.push(dir)
          break
        case "M":
          passages.growling.push(dir)
          break
        case "H":
          passages.glow.push(dir)
          break
        case "E":
          // Only mention exit if it's been discovered
          const exitEntity = entities.find((e) => e.type === "exit" && e.position.x === nx && e.position.y === ny)
          if (exitEntity && exitEntity.discovered) {
            passages.exit.push(dir)
          } else {
            // Use a different description for undiscovered exit doors
            passages.ancient.push(dir)
          }
          break
        case "K":
          passages.key.push(dir)
          break
        case "V":
          passages.mysterious.push(dir)
          break
        default:
          passages.open.push(dir)
          break
      }
    })

    // Build the description
    const surroundings = []

    if (passages.open.length > 0) {
      surroundings.push(`Open passages: ${passages.open.join(", ")}`)
    }
    if (passages.blocked.length > 0) {
      surroundings.push(`Blocked passages: ${passages.blocked.join(", ")}`)
    }
    if (passages.growling.length > 0) {
      surroundings.push(`Growling sounds: ${passages.growling.join(", ")}`)
    }
    if (passages.glow.length > 0) {
      surroundings.push(`Faint glow: ${passages.glow.join(", ")}`)
    }
    if (passages.exit.length > 0) {
      surroundings.push(`Exit door: ${passages.exit.join(", ")}`)
    }
    if (passages.key.length > 0) {
      surroundings.push(`Metallic glint: ${passages.key.join(", ")}`)
    }
    if (passages.mysterious.length > 0) {
      surroundings.push(`Something unusual: ${passages.mysterious.join(", ")}`)
    }
    if (passages.ancient.length > 0) {
      surroundings.push(`Ancient stonework: ${passages.ancient.join(", ")}`)
    }
    if (passages.wall.length > 0) {
      surroundings.push(`Solid wall: ${passages.wall.join(", ")}`)
    }

    return surroundings.join(". ")
  }

  // Fixed collectKey function to avoid player icon duplication
  const collectKey = (key: Entity, currentPlayer: Entity) => {
    // Safety check - if gameMap isn't initialized yet, return
    if (!gameMap || !gameMap.length) {
      return
    }

    // Update map - clear old position and set new position
    const newMap = [...gameMap]

    // Safety checks before accessing array indices
    if (
      currentPlayer.position.y >= 0 &&
      currentPlayer.position.y < newMap.length &&
      currentPlayer.position.x >= 0 &&
      currentPlayer.position.x < newMap[currentPlayer.position.y].length
    ) {
      // Clear the old position
      newMap[currentPlayer.position.y][currentPlayer.position.x] = "."
    }

    if (
      key.position.y >= 0 &&
      key.position.y < newMap.length &&
      key.position.x >= 0 &&
      key.position.x < newMap[key.position.y].length
    ) {
      // Set the new position
      newMap[key.position.y][key.position.x] = "P"
    }

    // Remove key from entities
    const newEntities = entities.filter((e) => e.id !== key.id)

    // Mark key position as visited
    setVisitedTiles((prev) => {
      if (!prev || !prev.length) return prev

      const newVisited = [...prev]
      if (
        key.position.y >= 0 &&
        key.position.y < newVisited.length &&
        key.position.x >= 0 &&
        newVisited[key.position.y] &&
        key.position.x < newVisited[key.position.y].length
      ) {
        newVisited[key.position.y][key.position.x] = true
      }
      return newVisited
    })

    setGameMap(newMap)
    setEntities(newEntities)
    setHasKey(true)

    // First announce finding the key - this will be read by the screen reader
    const keyMessage = "You found a rusty key! You can now unlock the exit door."

    // Update the live region for screen readers with the key message
    if (announcementRef.current) {
      announcementRef.current.textContent = keyMessage
    }

    // Add to game log
    addToGameLog(keyMessage)

    // Then describe the room after collecting the key
    setTimeout(() => {
      // Safety check for roomDescriptions
      if (!roomDescriptions || !roomDescriptions.length) return

      // Get the room description directly with safety checks
      if (
        key.position.y >= 0 &&
        key.position.y < roomDescriptions.length &&
        roomDescriptions[key.position.y] &&
        key.position.x >= 0 &&
        key.position.x < roomDescriptions[key.position.y].length
      ) {
        const roomDesc = roomDescriptions[key.position.y][key.position.x].description
        const surroundings = buildSurroundingsDescription(key.position.x, key.position.y)
        const message = `${roomDesc} ${surroundings}.`

        // Store the current location description
        setCurrentLocationDescription(message)

        // Add to game log without updating the screen reader announcement
        setGameLog((prev) => [...prev, message])
      }
    }, 100)
  }

  // Add message to game log
  const addToGameLog = (message: string) => {
    setGameLog((prev) => [...prev, message])

    // Update the live region for screen readers with the full message
    if (announcementRef.current) {
      announcementRef.current.textContent = message
    }
  }

  // Describe the current position and surroundings
  const describeCurrentPosition = (x: number, y: number) => {
    // Safety check - if gameMap isn't initialized yet, return early
    if (!gameMap || !gameMap.length || !roomDescriptions || !roomDescriptions.length) {
      addToGameLog("You stand at the entrance to the dungeon.")
      return
    }

    // Safety check - make sure the coordinates are valid
    if (y < 0 || y >= roomDescriptions.length || !roomDescriptions[y] || x < 0 || x >= roomDescriptions[y].length) {
      addToGameLog("You stand in an unknown area of the dungeon.")
      return
    }

    // Mark this room as visited in the room descriptions
    setRoomDescriptions((prev) => {
      if (!prev || !prev.length) return prev

      const newDescriptions = [...prev]
      if (y >= 0 && y < newDescriptions.length && newDescriptions[y] && x >= 0 && x < newDescriptions[y].length) {
        newDescriptions[y][x].visited = true
      }
      return newDescriptions
    })

    // Get the room description (which is now persistent)
    const roomDescription = roomDescriptions[y][x].description

    // Build surroundings description with safety checks
    const surroundings = buildSurroundingsDescription(x, y)

    const message = `${roomDescription} ${surroundings}.`

    // Store the current location description
    setCurrentLocationDescription(message)

    addToGameLog(message)
  }

  // Improve the handleCombat function with better safety checks
  const handleCombat = (enemy: Entity) => {
    if (!enemy || !enemy.health) return

    // Get the latest player and enemy state
    const currentPlayer = { ...player }
    const currentEnemy = { ...enemy }

    // Player attacks enemy
    const newEnemyHealth = currentEnemy.health - (currentPlayer.attack || 0)

    // Create a new message for this combat round - no reaction description on first attack
    let combatMessage = `You attack the ${currentEnemy.monsterType} for ${currentPlayer.attack} damage!`

    if (newEnemyHealth <= 0) {
      // Enemy defeated
      combatMessage += ` You defeated the ${currentEnemy.monsterType}!`
      combatMessage += ` Your health: ${currentPlayer.health}/100`

      // Update game log with the full combat message
      addToGameLog(combatMessage)

      // Update map with safety checks
      if (gameMap && gameMap.length) {
        const newMap = [...gameMap]
        if (
          currentEnemy.position.y >= 0 &&
          currentEnemy.position.y < newMap.length &&
          currentEnemy.position.x >= 0 &&
          currentEnemy.position.x < newMap[currentEnemy.position.y].length
        ) {
          newMap[currentEnemy.position.y][currentEnemy.position.x] = "."
          setGameMap(newMap)
        }
      }

      // Remove enemy from entities
      const newEntities = entities.filter((e) => e.id !== currentEnemy.id)
      setEntities(newEntities)
    } else {
      // Enemy survives and counterattacks
      const updatedEntities = entities.map((e) =>
        e.id === currentEnemy.id ? { ...e, health: newEnemyHealth, hasBeenAttacked: true } : e,
      )

      // Enemy attacks player - ALWAYS happens when enemy is still alive
      const newPlayerHealth = currentPlayer.health - (currentEnemy.attack || 0)

      // Add enemy attack to the combat message
      combatMessage += ` The ${currentEnemy.monsterType} attacks you for ${currentEnemy.attack} damage!`

      // Update the player defeat section in handleCombat
      if (newPlayerHealth <= 0) {
        // Player defeated
        combatMessage += " You have been defeated!"

        // Update game log with the full combat message
        addToGameLog(combatMessage)

        setPlayer((currentPlayer) => ({ ...currentPlayer, health: 0 }))
        setEntities(updatedEntities)

        if (rogueRun.active) {
          handleRogueRunGameOver("You were defeated in battle!")
        } else {
          addToGameLog("Game over. Press Enter to play again, or press Tab then Enter to Change Difficulty.")
          setGameStatus("lost")
        }
      } else {
        // Player survives
        combatMessage += ` Your health: ${newPlayerHealth}/100 | ${currentEnemy.monsterType}'s health: ${newEnemyHealth}/${currentEnemy.originalHealth}`

        // Update game log with the full combat message
        addToGameLog(combatMessage)

        setPlayer((currentPlayer) => ({ ...currentPlayer, health: newPlayerHealth }))
        setEntities(updatedEntities)
      }
    }
  }

  // Completely rewritten Rogue Run progression functions
  const handleRogueRunVictory = () => {
    // First, set game status to won
    setGameStatus("won")

    // Calculate the next round and determine if difficulty should change
    const nextRound = rogueRun.round + 1
    let nextDifficulty = rogueRun.difficulty
    let nextExtraMonsters = rogueRun.extraMonsters
    let difficultyChanged = false

    // Determine next difficulty based on round number
    // Rounds 1-3: Normal difficulty
    // Rounds 4-6: Hard difficulty
    // Rounds 7+: Adventurer difficulty with extra monsters
    if (nextRound === 4) {
      nextDifficulty = "hard"
      difficultyChanged = true
      console.log("Changing to hard difficulty for round 4")
    } else if (nextRound === 7) {
      nextDifficulty = "adventurer"
      difficultyChanged = true
      console.log("Changing to adventurer difficulty for round 7")
    } else if (nextRound > 7) {
      // Add one more monster for each additional round after 7
      nextExtraMonsters = nextRound - 7
    }

    // Log the progression for debugging
    console.log(
      `Rogue Run victory: Round ${rogueRun.round} completed. Next round: ${nextRound}, Next difficulty: ${nextDifficulty}, Extra monsters: ${nextExtraMonsters}`,
    )

    // Update the Rogue Run state with next round info and mark as pending next round
    setRogueRun({
      active: true,
      round: nextRound,
      difficulty: nextDifficulty,
      extraMonsters: nextExtraMonsters,
      pendingNextRound: true,
    })

    // Build victory message
    let victoryMessage = `Congratulations! You completed round ${rogueRun.round} of your Rogue Run!`

    if (difficultyChanged) {
      if (nextDifficulty === "hard") {
        victoryMessage += " The dungeon size will increase to an 8×8 grid in the next round."
      } else if (nextDifficulty === "adventurer") {
        victoryMessage += " The dungeon size will increase to a 10×10 grid in the next round."
      }
    } else if (nextDifficulty === "adventurer" && nextRound > 7) {
      victoryMessage += ` The next dungeon will contain ${nextExtraMonsters} additional monster${nextExtraMonsters > 1 ? "s" : ""}.`
    }

    victoryMessage += " Press Enter to continue to next round."
    addToGameLog(victoryMessage)
  }

  const startNextRogueRunRound = () => {
    // Safety check - only proceed if we're actually pending a next round
    if (!rogueRun.pendingNextRound) {
      console.log("startNextRogueRunRound called but not in pending state")
      return
    }

    // First, update the game status to playing
    setGameStatus("playing")

    // Clear the game log
    setGameLog([])

    // IMPORTANT: Get the current rogueRun state and update pendingNextRound
    // We need to use the current state directly to ensure we have the latest difficulty
    const currentRogueRun = {
      ...rogueRun,
      pendingNextRound: false,
    }

    // Update the Rogue Run state to no longer be pending
    setRogueRun(currentRogueRun)

    // Get the base settings for the current difficulty
    const baseSettings = DIFFICULTY_SETTINGS[currentRogueRun.difficulty]

    // Calculate the correct dungeon size based on the current difficulty
    const newDungeonSize = baseSettings.size

    // Apply the difficulty settings to state (these will be used for future renders)
    setDungeonSize(newDungeonSize)
    setEnemyCount(baseSettings.enemyCount + currentRogueRun.extraMonsters)
    setPotionCount(baseSettings.potionCount)
    setWallMultiplier(baseSettings.wallMultiplier)

    console.log(
      `Applied Rogue Run settings: Round ${currentRogueRun.round}, Difficulty ${currentRogueRun.difficulty}, Size ${newDungeonSize}, Enemies ${baseSettings.enemyCount + currentRogueRun.extraMonsters}`,
    )

    // Add initial message to game log
    addToGameLog(
      `Rogue Run round ${currentRogueRun.round} - ${currentRogueRun.difficulty.charAt(0).toUpperCase() + currentRogueRun.difficulty.slice(1)} difficulty (${newDungeonSize}×${newDungeonSize} grid).`,
    )

    // CRITICAL: Reset all game state completely before initializing new map
    setGameMap([])
    setEntities([])
    setVisitedTiles([])
    setRoomDescriptions([])
    setHasKey(false)
    setCurrentLocationDescription("")
    setMonsterEncounters({})
    setUsedRoomDescriptions(new Set())

    // Reset player to initial state
    setPlayer({
      id: "player",
      position: { x: 0, y: 0 },
      type: "player",
      health: 100,
      attack: 20,
      description: "You, the brave adventurer",
    })

    // Use a longer delay to ensure ALL state updates are complete
    setTimeout(() => {
      console.log(`Initializing new map for round ${currentRogueRun.round} with size: ${newDungeonSize}`)
      // Force a complete re-initialization of the game with the correct dungeon size
      initializeGame(newDungeonSize)
    }, 800) // Increased delay for more reliable state updates
  }

  const handleRogueRunGameOver = (reason: string) => {
    setGameStatus("lost")

    // Add game over message with round count
    addToGameLog(
      `${reason} Game over! You survived ${rogueRun.round} round${rogueRun.round !== 1 ? "s" : ""} in your Rogue Run.`,
    )
    addToGameLog("Press Enter to play again, or press Tab then Enter to Change Difficulty.")

    // Reset Rogue Run state to initial values
    setRogueRun({
      active: true, // Keep active so we know we're still in Rogue Run mode
      round: 1,
      difficulty: "normal",
      extraMonsters: 0,
      pendingNextRound: false,
    })

    // Explicitly reset dungeon size to normal
    const normalSettings = DIFFICULTY_SETTINGS.normal
    setDungeonSize(normalSettings.size)
    setEnemyCount(normalSettings.enemyCount)
    setPotionCount(normalSettings.potionCount)
    setWallMultiplier(normalSettings.wallMultiplier)
  }

  // Restart the game with the same difficulty
  const restartGame = () => {
    // If we're in a Rogue Run and the game is over, reset to round 1
    if (difficulty === "roguerun") {
      // Reset Rogue Run state to initial values
      setRogueRun({
        active: true,
        round: 1,
        difficulty: "normal",
        extraMonsters: 0,
        pendingNextRound: false,
      })

      // IMPORTANT: Explicitly reset to normal difficulty settings
      const normalSettings = DIFFICULTY_SETTINGS.normal
      setDungeonSize(normalSettings.size)
      setEnemyCount(normalSettings.enemyCount)
      setPotionCount(normalSettings.potionCount)
      setWallMultiplier(normalSettings.wallMultiplier)

      // Add a log message to confirm reset
      addToGameLog(
        `Rogue Run restarted! Round 1 - Normal difficulty (${normalSettings.size}×${normalSettings.size} grid).`,
      )

      // Set game status to playing
      setGameStatus("playing")
      setGameLog([])

      // Force a longer delay to ensure ALL state updates are complete before initializing
      setTimeout(() => {
        initializeGame()
      }, 300) // Increased delay for more reliable state updates

      return // Exit early to prevent the code below from running
    }

    // For non-Rogue Run games
    setGameStatus("playing")
    setGameLog([])

    // Force a small delay to ensure state updates before initializing
    setTimeout(() => {
      initializeGame()
    }, 100)
  }

  // Change difficulty and restart
  const changeDifficulty = () => {
    setGameStatus("playing")
    setGameLog([])
    setGameStarted(false) // Go back to difficulty selection
  }

  // Get tile representation for visual display
  const getTileRepresentation = (tile: string) => {
    switch (tile) {
      case "P":
        return (
          <div className="flex items-center justify-center w-10 h-10 bg-blue-500 rounded-full" aria-hidden="true">
            <div className="w-6 h-6 rounded-full border-[3px] border-white bg-blue-500"></div>
          </div>
        )
      case "M":
        return (
          <div className="flex items-center justify-center w-10 h-10 bg-red-500 rounded-full" aria-hidden="true">
            <div className="w-6 h-6 rotate-45 transform border-[3px] border-white bg-red-500"></div>
          </div>
        )
      case "H":
        return (
          <div className="flex items-center justify-center w-10 h-10 bg-green-500 rounded-full" aria-hidden="true">
            <Heart className="text-white" />
          </div>
        )
      case "E":
        return (
          <div className="flex items-center justify-center w-10 h-10 bg-purple-500 rounded-full" aria-hidden="true">
            <div className="text-white text-4xl font-bold flex items-center justify-center h-full">×</div>
          </div>
        )
      case "K":
        return (
          <div className="flex items-center justify-center w-10 h-10 bg-yellow-500 rounded-full" aria-hidden="true">
            <Key className="text-white" />
          </div>
        )
      case "V":
        return (
          <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center" aria-hidden="true">
            <div className="w-6 h-6 bg-black border-2 border-gray-700 rounded-full"></div>
          </div>
        )
      case "#":
        return (
          <div className="w-10 h-10 bg-gray-700 rounded-md overflow-hidden" aria-hidden="true">
            <div className="w-full h-full grid grid-rows-4">
              <div className="grid grid-cols-2">
                <div className="border-r-2 border-b-2 border-gray-500"></div>
                <div className="border-b-2 border-gray-500"></div>
              </div>
              <div className="grid grid-cols-2 -ml-[5px]">
                <div className="border-r-2 border-b-2 border-gray-500"></div>
                <div className="border-r-2 border-b-2 border-gray-500 ml-[5px]"></div>
                <div className="border-b-2 border-gray-500 -ml-[5px]"></div>
              </div>
              <div className="grid grid-cols-2">
                <div className="border-r-2 border-b-2 border-gray-500"></div>
                <div className="border-b-2 border-gray-500"></div>
              </div>
              <div className="grid grid-cols-2 -ml-[5px]">
                <div className="border-r-2 border-gray-500"></div>
                <div className="border-r-2 border-gray-500 ml-[5px]"></div>
                <div className="-ml-[5px]"></div>
              </div>
            </div>
          </div>
        )
      default:
        return <div className="w-10 h-10 bg-gray-200 border-2 border-gray-700 rounded-md" aria-hidden="true"></div>
    }
  }

  // Render difficulty selection screen if game hasn't started
  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6">
        <Card className="w-full max-w-md p-6">
          <h2 className="text-xl font-semibold mb-4">Select Difficulty</h2>

          <RadioGroup
            value={difficulty}
            onValueChange={(value) => setDifficulty(value as Difficulty)}
            className="space-y-4 mb-6"
          >
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="easy" id="easy" />
              <Label htmlFor="easy" className="font-medium">
                {DIFFICULTY_SETTINGS.easy.label}
              </Label>
            </div>

            <div className="flex items-start space-x-2">
              <RadioGroupItem value="normal" id="normal" />
              <Label htmlFor="normal" className="font-medium">
                {DIFFICULTY_SETTINGS.normal.label}
              </Label>
            </div>

            <div className="flex items-start space-x-2">
              <RadioGroupItem value="hard" id="hard" />
              <Label htmlFor="hard" className="font-medium">
                {DIFFICULTY_SETTINGS.hard.label}
              </Label>
            </div>

            <div className="flex items-start space-x-2">
              <RadioGroupItem value="adventurer" id="adventurer" />
              <Label htmlFor="adventurer" className="font-medium">
                {DIFFICULTY_SETTINGS.adventurer.label}
              </Label>
            </div>
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="roguerun" id="roguerun" />
              <Label htmlFor="roguerun" className="font-medium">
                Rogue Run (See how long you can survive in the ancient dungeon)
              </Label>
            </div>
          </RadioGroup>

          <Button onClick={startGame} className="w-full" size="lg">
            Start Adventure
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div id="game-top" className="flex flex-col gap-6 overflow-auto h-screen" tabIndex={-1}>
      {/* Game over or victory screen - positioned at the top for easy access */}
      {gameStatus !== "playing" && (
        <div className="text-center p-4 bg-gray-100 rounded-md mb-4">
          <h2 className="text-2xl font-bold mb-2">{gameStatus === "won" ? "Victory!" : "Game Over"}</h2>
          <p className="mb-4">
            {gameStatus === "won" && rogueRun.active && rogueRun.pendingNextRound
              ? `You completed round ${rogueRun.round - 1}! Press Enter or the button below to continue to round ${rogueRun.round}.`
              : gameStatus === "won"
                ? "You escaped the dungeon successfully!"
                : "You were defeated in the dungeon."}
          </p>

          {rogueRun.pendingNextRound ? (
            <Button onClick={startNextRogueRunRound} className="mb-4" autoFocus>
              Continue to Next Round
            </Button>
          ) : (
            <p className="mb-4 text-sm">Press Enter to play again, or press Tab then Enter to Change Difficulty.</p>
          )}

          {!rogueRun.pendingNextRound && (
            <div className="flex justify-center gap-4">
              <Button ref={playAgainButtonRef} onClick={restartGame} autoFocus>
                Play Again
              </Button>
              <Button ref={changeDifficultyButtonRef} onClick={changeDifficulty}>
                Change Difficulty
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Main heading for screen readers */}
      <h1 className="sr-only">Screen Reader Dungeon Crawler</h1>

      {/* Welcome message */}
      <div className="text-lg" ref={welcomeRef} tabIndex={0} aria-label="Welcome message">
        Welcome to the dungeon! You stand at the dungeon's entrance in the top left corner of the grid. Find the key and
        the exit to win!
      </div>

      {/* Main game area - Map on left, How to Play on right */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* How to Play section - visually on the right but read first */}
        <div className="md:order-2" aria-labelledby="how-to-play-heading" tabIndex={0}>
          <Card className="p-4">
            <h2 id="how-to-play-heading" className="text-xl font-bold mb-2">
              How to Play:
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use arrow keys to move through the dungeon</li>
              <li>Find health potions to restore your health</li>
              <li>Find the key to unlock the exit door</li>
              <li>Defeat monsters by moving into them</li>
              <li>Reach the exit to win the game</li>
              <li>Press 'S' key to check your status</li>
              <li>Press 'L' key to check your location</li>
              <li>Press 'M' key to get a map overview</li>
            </ul>
          </Card>

          {/* Game log - now below How to Play with reduced height */}
          <Card className="p-4 mt-6">
            <h2 className="text-xl font-bold mb-4">Game Log</h2>
            <div
              className="h-[200px] overflow-y-auto p-2 bg-gray-100 rounded-md"
              role="log"
              aria-live="polite"
              aria-atomic="false"
            >
              {gameLog.map((log, index) => (
                <p key={index} className="mb-2">
                  {log}
                </p>
              ))}
              <div ref={gameLogEndRef} />
            </div>

            {/* Hidden announcement for screen readers */}
            <div ref={announcementRef} className="sr-only" aria-live="assertive" aria-atomic="true"></div>
          </Card>
        </div>

        {/* Map section - visually on the left but read second */}
        <div className="md:order-1" aria-labelledby="map-heading" tabIndex={0}>
          <Card className="p-4" ref={mapRef}>
            <h2 id="map-heading" className="text-xl font-bold mb-4">
              Map (Explored Areas Only)
            </h2>
            <div className="grid gap-1" aria-hidden="true">
              {gameMap.map((row, y) => (
                <div key={y} className="flex gap-1">
                  {row.map((tile, x) => (
                    <div key={`${x}-${y}`}>
                      {visitedTiles[y] && visitedTiles[y][x] ? (
                        getTileRepresentation(tile)
                      ) : (
                        <div className="w-10 h-10 bg-gray-900 rounded-md" aria-hidden="true"></div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Status section - now inside the map card */}
            <div className="mt-6 mb-4 p-3 bg-gray-50 rounded-md">
              <h3 className="text-lg font-bold mb-2">Status</h3>
              <div className="flex items-center gap-2 mb-2">
                <Heart className="text-red-500" />
                <span>Health: {player.health}/100</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Sword className="text-gray-700" />
                <span>Attack: {player.attack}</span>
              </div>
              {hasKey && (
                <div className="flex items-center gap-2 mb-2">
                  <Key className="text-yellow-500" />
                  <span>Key: Found</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="font-medium">Difficulty:</span>
                {rogueRun.active ? (
                  <span className="font-bold">
                    Rogue Run - Round {rogueRun.round} ({DIFFICULTY_SETTINGS[rogueRun.difficulty].size}×
                    {DIFFICULTY_SETTINGS[rogueRun.difficulty].size} grid)
                  </span>
                ) : (
                  <>
                    <span className="font-bold">{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</span>
                    <span className="text-sm">
                      ({DIFFICULTY_SETTINGS[difficulty].size}×{DIFFICULTY_SETTINGS[difficulty].size} grid)
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Debug section - only visible during development */}
            {process.env.NODE_ENV === "development" && (
              <div className="mt-4 p-2 border border-red-300 rounded bg-red-50">
                <h3 className="text-sm font-bold text-red-700">Debug Controls</h3>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      console.log("Debug - Forcing map regeneration")
                      // Force complete reset and regeneration
                      setGameMap([])
                      setEntities([])
                      setTimeout(() => initializeGame(), 100)
                    }}
                  >
                    Regenerate Map
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      console.log("Current game state:", {
                        rogueRun,
                        dungeonSize,
                        enemyCount,
                        mapSize: gameMap.length > 0 ? `${gameMap.length}x${gameMap[0].length}` : "No map",
                      })
                    }}
                  >
                    Log State
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-4">
              <h3 className="font-bold mb-2">Legend:</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full">
                    <div className="w-3.5 h-3.5 rounded-full border-[3px] border-white bg-blue-500"></div>
                  </div>
                  <span>Player - blue circle with ring</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gray-200 border-2 border-gray-700 rounded-md"></div>
                  <span>Empty Space - light gray square with dark border</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gray-700 rounded-md overflow-hidden">
                    <div className="w-full h-full grid grid-rows-2">
                      <div className="grid grid-cols-2">
                        <div className="border-r-2 border-b-2 border-gray-500"></div>
                        <div className="border-b-2 border-gray-500"></div>
                      </div>
                      <div className="grid grid-cols-2 -ml-[2px]">
                        <div className="border-r-2 border-gray-500"></div>
                        <div className="border-r-2 border-gray-500 ml-[2px]"></div>
                        <div className="-ml-[2px]"></div>
                      </div>
                    </div>
                  </div>
                  <span>Wall - dark gray square with brick pattern</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gray-900 rounded-md"></div>
                  <span>Unexplored - black square</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 bg-red-500 rounded-full">
                    <div className="w-3.5 h-3.5 rotate-45 transform border-[3px] border-white bg-red-500"></div>
                  </div>
                  <span>Monster - red circle with diamond outline</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 bg-purple-500 rounded-full">
                    <div className="text-white text-2xl font-bold flex items-center justify-center h-full">×</div>
                  </div>
                  <span>Exit Door - purple circle with X</span>
                </li>
              </ul>
            </div>
          </Card>
        </div>
      </div>

      {/* Keyboard event handler div */}
      <div
        className="sr-only"
        ref={gameContainerRef}
        tabIndex={0}
        onKeyDown={(e) => {
          // Backup keyboard handler in case the window event listener doesn't work
          if (gameStatus !== "playing") return

          switch (e.key) {
            case "ArrowUp":
              e.preventDefault() // Prevent page scrolling
              movePlayer(0, -1)
              break
            case "ArrowDown":
              e.preventDefault() // Prevent page scrolling
              movePlayer(0, 1)
              break
            case "ArrowLeft":
              e.preventDefault() // Prevent page scrolling
              movePlayer(-1, 0)
              break
            case "ArrowRight":
              e.preventDefault() // Prevent page scrolling
              movePlayer(1, 0)
              break
            case "s":
            case "S":
              e.preventDefault()
              announcePlayerStatus()
              break
            case "l":
            case "L":
              e.preventDefault()
              announceCurrentLocation()
              break
            case "m":
            case "M":
              e.preventDefault()
              announceMapOverview()
              break
          }
        }}
      />
    </div>
  )
}
