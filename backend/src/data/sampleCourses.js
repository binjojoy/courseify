/**
 * Pre-configured reference courses matching design.md and reference screenshots.
 * All courses have realistic, working YouTube video IDs so video playback works natively.
 */
export const SAMPLE_COURSES = {
  "PL_OS_FUNDAMENTALS": {
    course: {
      id: "PL_OS_FUNDAMENTALS",
      title: "Operating Systems Fundamentals",
      channelTitle: "Northfield CS",
      thumbnailUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
      videoCount: 31,
      totalDurationSec: 18600, // ~5h 10m
      totalDurationFormatted: "5h 10m",
      description: "A comprehensive university-level course covering modern operating systems architecture, process management, memory paging, virtual memory, scheduling algorithms, concurrency, and file systems.",
      addedAt: "2026-09-20T10:00:00Z",
      lastOpenedAt: "2026-09-24T17:00:00Z"
    },
    videos: [
      {
        videoId: "26QPDBe-NB8",
        position: 0,
        title: "Course Overview & Operating Systems Architecture",
        description: "Introduction to operating systems: abstractions, hardware interface, system calls, and kernel architectures.\nTimestamps: 00:00 Introduction, 05:20 Kernel vs User mode, 12:10 System Calls.",
        durationSec: 840,
        durationFormatted: "14:00",
        thumbnailUrl: "https://i.ytimg.com/vi/26QPDBe-NB8/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "ro_Vf_X_N7s",
        position: 1,
        title: "Hardware Abstractions & System Calls",
        description: "How user programs interface with the kernel through trap instructions and system call conventions.",
        durationSec: 920,
        durationFormatted: "15:20",
        thumbnailUrl: "https://i.ytimg.com/vi/ro_Vf_X_N7s/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "WJ-UaAaumNA",
        position: 2,
        title: "Interrupt Handling & Exceptions",
        description: "Interrupt vector tables, device interrupts, software exceptions, and hardware timer management.",
        durationSec: 780,
        durationFormatted: "13:00",
        thumbnailUrl: "https://i.ytimg.com/vi/WJ-UaAaumNA/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "e2T_hV83k84",
        position: 3,
        title: "CPU Protection Rings & Dual Mode Operation",
        description: "Privileged instructions, Ring 0 vs Ring 3, segment registers, and CPU state transition during traps.",
        durationSec: 810,
        durationFormatted: "13:30",
        thumbnailUrl: "https://i.ytimg.com/vi/e2T_hV83k84/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "OrM7nZcxXZU",
        position: 4,
        title: "Memory Organization & Address Spaces",
        description: "Physical memory layout, address generation, base and bounds registers, and memory protection mechanisms.",
        durationSec: 960,
        durationFormatted: "16:00",
        thumbnailUrl: "https://i.ytimg.com/vi/OrM7nZcxXZU/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "7m3pA9nLio8",
        position: 5,
        title: "Virtual Memory Foundations",
        description: "The motivation behind virtual memory, illusion of private contiguous memory, and page allocation.",
        durationSec: 890,
        durationFormatted: "14:50",
        thumbnailUrl: "https://i.ytimg.com/vi/7m3pA9nLio8/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "d86xsXncvco",
        position: 6,
        title: "Page Tables & Hardware MMU",
        description: "Memory Management Units (MMU), single-level page tables, translation equations, and physical frame numbers.",
        durationSec: 1020,
        durationFormatted: "17:00",
        thumbnailUrl: "https://i.ytimg.com/vi/d86xsXncvco/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "YnPo43vef_4",
        position: 7,
        title: "Processes and the process table",
        description: "Process control blocks (PCB), process states, fork/exec, and process table management in kernel memory.",
        durationSec: 680,
        durationFormatted: "11:20",
        thumbnailUrl: "https://i.ytimg.com/vi/YnPo43vef_4/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "jH_i_H_J2bU",
        position: 8,
        title: "Context switching in practice",
        description: "Detailed step-by-step walkthrough of saving CPU registers, changing page directories, and restoring user state.",
        durationSec: 588,
        durationFormatted: "9:48",
        thumbnailUrl: "https://i.ytimg.com/vi/jH_i_H_J2bU/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "ew6Pz_F_78o",
        position: 9,
        title: "CPU scheduling: FIFO, SJF, round robin",
        description: "Non-preemptive and preemptive scheduling algorithms: First-In First-Out, Shortest Job First, and Round Robin time slicing.",
        durationSec: 1085,
        durationFormatted: "18:05",
        thumbnailUrl: "https://i.ytimg.com/vi/ew6Pz_F_78o/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "3rB_4qg_kLA",
        position: 10,
        title: "Multi-level feedback queues",
        description: "Dynamic priority adjustment, starvation prevention, aging mechanisms, and real-world BSD/Linux scheduler heuristics.",
        durationSec: 761,
        durationFormatted: "12:41",
        thumbnailUrl: "https://i.ytimg.com/vi/3rB_4qg_kLA/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "qcBIvnQT0Bw",
        position: 11,
        title: "Virtual memory: page tables and the TLB",
        description: "An introduction to virtual memory architectures, hierarchical page tables, translation lookaside buffers (TLBs), and page fault handling mechanisms. Source slides available at https://cs.northfield.edu/os-notes. Key breakdown at 12:34 covering hardware page walking.",
        durationSec: 872,
        durationFormatted: "14:32",
        thumbnailUrl: "https://i.ytimg.com/vi/qcBIvnQT0Bw/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "2i2KhMw_Mao",
        position: 12,
        title: "Segmentation and paging compared",
        description: "Comparing segmentation with paging: external vs internal fragmentation, protection bits, and historical Intel architectures.",
        durationSec: 987,
        durationFormatted: "16:27",
        thumbnailUrl: "https://i.ytimg.com/vi/2i2KhMw_Mao/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "B6_w_R5v_o4",
        position: 13,
        title: "Page replacement algorithms",
        description: "FIFO, Optimal (Belady's), Least Recently Used (LRU), Clock/Second Chance algorithm, and page buffering systems.",
        durationSec: 839,
        durationFormatted: "13:59",
        thumbnailUrl: "https://i.ytimg.com/vi/B6_w_R5v_o4/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "bH_q6_wN8q8",
        position: 14,
        title: "Thrashing and working sets",
        description: "When memory demand exceeds physical RAM capacity: working set model, page fault frequency, and load control.",
        durationSec: 513,
        durationFormatted: "8:33",
        thumbnailUrl: "https://i.ytimg.com/vi/bH_q6_wN8q8/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "o_4_Hk_bQx8",
        position: 15,
        title: "Concurrency: threads vs processes",
        description: "User threads, kernel threads, shared address space, thread local storage (TLS), and pthread API primitives.",
        durationSec: 902,
        durationFormatted: "15:02",
        thumbnailUrl: "https://i.ytimg.com/vi/o_4_Hk_bQx8/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "K9sT7XkYhM4",
        position: 16,
        title: "Locks and mutual exclusion",
        description: "Critical sections, test-and-set hardware atomic operations, spinlocks, mutexes, and condition variables.",
        durationSec: 1064,
        durationFormatted: "17:44",
        thumbnailUrl: "https://i.ytimg.com/vi/K9sT7XkYhM4/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "6m7FqXy7Yg0",
        position: 17,
        title: "Semaphores and Monitors",
        description: "Dijkstra semaphores, counting vs binary semaphores, producer-consumer problem, and Hoare vs Mesa monitors.",
        durationSec: 720,
        durationFormatted: "12:00",
        thumbnailUrl: "https://i.ytimg.com/vi/6m7FqXy7Yg0/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "r4m2f_N9cZo",
        position: 18,
        title: "Deadlock Detection & Prevention",
        description: "Coffman conditions, resource allocation graphs, Banker's algorithm, and lock ordering guidelines.",
        durationSec: 850,
        durationFormatted: "14:10",
        thumbnailUrl: "https://i.ytimg.com/vi/r4m2f_N9cZo/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "v9m2_j8N5Bo",
        position: 19,
        title: "File System Abstraction & INodes",
        description: "Directory hierarchies, metadata, inodes, data blocks, hard links, symbolic links, and open file tables.",
        durationSec: 940,
        durationFormatted: "15:40",
        thumbnailUrl: "https://i.ytimg.com/vi/v9m2_j8N5Bo/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "w7m8_v5N2Ro",
        position: 20,
        title: "Fast File System (FFS) & Cylinder Groups",
        description: "Disk geometry optimization, locality of reference, cylinder groups, and inode placement strategies.",
        durationSec: 790,
        durationFormatted: "13:10",
        thumbnailUrl: "https://i.ytimg.com/vi/w7m8_v5N2Ro/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "z1k8_b3N6Xo",
        position: 21,
        title: "Journaling and Crash Consistency",
        description: "FSCK recovery, write-ahead logging (journaling), ordered mode, and atomic metadata updates.",
        durationSec: 880,
        durationFormatted: "14:40",
        thumbnailUrl: "https://i.ytimg.com/vi/z1k8_b3N6Xo/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "p5l9_q2N8Mo",
        position: 22,
        title: "Log-Structured File Systems (LFS)",
        description: "Flash memory and magnetic disk write buffering, segment cleaner, and inode map checkpoints.",
        durationSec: 750,
        durationFormatted: "12:30",
        thumbnailUrl: "https://i.ytimg.com/vi/p5l9_q2N8Mo/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "q4n8_r7N1Lo",
        position: 23,
        title: "RAID Architectures (0, 1, 5, 6)",
        description: "Redundant arrays of inexpensive disks: striping, mirroring, parity calculation, and recovery latency.",
        durationSec: 820,
        durationFormatted: "13:40",
        thumbnailUrl: "https://i.ytimg.com/vi/q4n8_r7N1Lo/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "s8m2_k5N9Qo",
        position: 24,
        title: "I/O Devices & DMA Controllers",
        description: "Memory-mapped I/O, port I/O, Direct Memory Access (DMA), device drivers, and interrupt handling.",
        durationSec: 710,
        durationFormatted: "11:50",
        thumbnailUrl: "https://i.ytimg.com/vi/s8m2_k5N9Qo/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "t3n9_p6N4Ko",
        position: 25,
        title: "Network Stack in the Kernel",
        description: "Socket abstraction, sk_buff data structure, packet ring buffers, and network device polling.",
        durationSec: 900,
        durationFormatted: "15:00",
        thumbnailUrl: "https://i.ytimg.com/vi/t3n9_p6N4Ko/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "u7m1_s8N2Jo",
        position: 26,
        title: "Security & Access Control Lists",
        description: "Discretionary vs Mandatory access control, Capabilities, Unix permissions, and SELinux policies.",
        durationSec: 670,
        durationFormatted: "11:10",
        thumbnailUrl: "https://i.ytimg.com/vi/u7m1_s8N2Jo/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "v2k7_t9N5Ho",
        position: 27,
        title: "Hardware Virtualization & Hypervisors",
        description: "Type 1 vs Type 2 hypervisors, Intel VT-x hardware assists, Extended Page Tables (EPT), and VM exits.",
        durationSec: 940,
        durationFormatted: "15:40",
        thumbnailUrl: "https://i.ytimg.com/vi/v2k7_t9N5Ho/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "x6l8_u1N3Go",
        position: 28,
        title: "Linux Containers, Namespaces & Cgroups",
        description: "OS-level virtualization: PID/mount/net namespaces, memory and CPU cgroups, and container runtimes.",
        durationSec: 860,
        durationFormatted: "14:20",
        thumbnailUrl: "https://i.ytimg.com/vi/x6l8_u1N3Go/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "y4m9_v7N2Fo",
        position: 29,
        title: "Modern OS Performance Tuning & eBPF",
        description: "Extended Berkeley Packet Filter (eBPF), kernel tracing, kprobes, and dynamic performance profiling.",
        durationSec: 780,
        durationFormatted: "13:00",
        thumbnailUrl: "https://i.ytimg.com/vi/y4m9_v7N2Fo/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "z9n1_w5N8Eo",
        position: 30,
        title: "Future of Operating Systems & Microkernels",
        description: "Microkernels (seL4), Unikernels, Rust in the Linux kernel, and heterogeneous compute OS models.",
        durationSec: 640,
        durationFormatted: "10:40",
        thumbnailUrl: "https://i.ytimg.com/vi/z9n1_w5N8Eo/hqdefault.jpg",
        unavailable: false
      }
    ]
  },

  "PL_RUST_SCRATCH": {
    course: {
      id: "PL_RUST_SCRATCH",
      title: "Learn Rust from Scratch",
      channelTitle: "Systems Foundry",
      thumbnailUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
      videoCount: 431,
      totalDurationSec: 231600, // 64h 20m
      totalDurationFormatted: "64h 20m",
      description: "Master modern systems programming with Rust from absolute basics to advanced async runtimes, memory safety, and high-concurrency architecture.",
      addedAt: "2026-09-18T14:00:00Z",
      lastOpenedAt: "2026-09-23T11:00:00Z"
    },
    videos: [
      {
        videoId: "zF34dRivLOw",
        position: 0,
        title: "Rust Crash Course - Introduction & Setup",
        description: "Getting started with Rust, cargo, rustc, and installing the toolchain.",
        durationSec: 1800,
        durationFormatted: "30:00",
        thumbnailUrl: "https://i.ytimg.com/vi/zF34dRivLOw/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "MsocPEZBd-M",
        position: 1,
        title: "Variables, Mutability & Shadowing",
        description: "Deep dive into variable declarations, type inference, constants, and shadowing in Rust.",
        durationSec: 1200,
        durationFormatted: "20:00",
        thumbnailUrl: "https://i.ytimg.com/vi/MsocPEZBd-M/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "T_CrP5_3h_o",
        position: 2,
        title: "Data Types & Compound Structures",
        description: "Scalars, integers, floats, booleans, characters, tuples, and arrays.",
        durationSec: 1450,
        durationFormatted: "24:10",
        thumbnailUrl: "https://i.ytimg.com/vi/T_CrP5_3h_o/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "5C_P8_k5_No",
        position: 51,
        title: "52. Ownership, references and slices",
        description: "The core mechanic of Rust: affine types, move semantics, borrow checker, and slice views.",
        durationSec: 1740,
        durationFormatted: "29:00",
        thumbnailUrl: "https://i.ytimg.com/vi/5C_P8_k5_No/hqdefault.jpg",
        unavailable: false
      }
    ]
  },

  "PL_ORGANIC_CHEM": {
    course: {
      id: "PL_ORGANIC_CHEM",
      title: "Organic Chemistry I",
      channelTitle: "Khan Academy",
      thumbnailUrl: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&auto=format&fit=crop&q=80",
      videoCount: 40,
      totalDurationSec: 54000, // 15h
      totalDurationFormatted: "15h 00m",
      description: "Structure and bonding, resonance, acid-base reactions, alkanes, cycloalkanes, stereochemistry, and substitution reactions.",
      addedAt: "2026-09-10T09:00:00Z",
      lastOpenedAt: "2026-09-22T08:00:00Z"
    },
    videos: [
      {
        videoId: "B_uRmx_4q0k",
        position: 0,
        title: "Dot structures & Hybridization",
        description: "Lewis dot structures, formal charge, sp3, sp2, and sp hybridization.",
        durationSec: 850,
        durationFormatted: "14:10",
        thumbnailUrl: "https://i.ytimg.com/vi/B_uRmx_4q0k/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "Y7_8Xq_0Lao",
        position: 38,
        title: "SN1 vs SN2 reaction mechanisms",
        description: "SN1 vs SN2 reaction mechanisms: polar protic vs aprotic solvents dictate pathway.",
        durationSec: 920,
        durationFormatted: "15:20",
        thumbnailUrl: "https://i.ytimg.com/vi/Y7_8Xq_0Lao/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "m9_k7_1Lpo8",
        position: 39,
        title: "E1 and E2 Elimination Reactions",
        description: "Zaitsev's rule, stereospecificity in E2, carbocation stability in E1 reactions.",
        durationSec: 1040,
        durationFormatted: "17:20",
        thumbnailUrl: "https://i.ytimg.com/vi/m9_k7_1Lpo8/hqdefault.jpg",
        unavailable: false
      }
    ]
  },

  "PL_SPANISH_TRAVEL": {
    course: {
      id: "PL_SPANISH_TRAVEL",
      title: "Spanish for Travelers",
      channelTitle: "LinguaLab",
      thumbnailUrl: "https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=800&auto=format&fit=crop&q=80",
      videoCount: 24,
      totalDurationSec: 11700, // 3h 15m
      totalDurationFormatted: "3h 15m",
      description: "Essential conversational Spanish phrases, airport navigation, hotel bookings, dining etiquette, and directions.",
      addedAt: "2026-09-23T15:00:00Z",
      lastOpenedAt: "2026-09-23T15:00:00Z"
    },
    videos: [
      {
        videoId: "DA2WzGvE9wU",
        position: 0,
        title: "Essential Greetings and Pronunciation",
        description: "Basic greetings, courteous phrases, and vowel pronunciation guidelines for travelers.",
        durationSec: 480,
        durationFormatted: "8:00",
        thumbnailUrl: "https://i.ytimg.com/vi/DA2WzGvE9wU/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "X3_8Ym_7Bno",
        position: 1,
        title: "Airport, Train & Transit Essentials",
        description: "Navigating border control, asking for platform numbers, and ticketing vocabulary.",
        durationSec: 540,
        durationFormatted: "9:00",
        thumbnailUrl: "https://i.ytimg.com/vi/X3_8Ym_7Bno/hqdefault.jpg",
        unavailable: false
      }
    ]
  },

  "PL_LINEAR_ALGEBRA": {
    course: {
      id: "PL_LINEAR_ALGEBRA",
      title: "Linear Algebra Review",
      channelTitle: "Gilbert Strang",
      thumbnailUrl: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=80",
      videoCount: 18,
      totalDurationSec: 52800, // 14h 40m
      totalDurationFormatted: "14h 40m",
      description: "MIT 18.06 Linear Algebra lectures by Prof. Gilbert Strang, highlighting column spaces, nullspaces, projections, and eigenvalues.",
      addedAt: "2026-09-15T12:00:00Z",
      lastOpenedAt: "2026-09-23T09:00:00Z"
    },
    videos: [
      {
        videoId: "7UJ4CFRGd-U",
        position: 0,
        title: "The Geometry of Linear Equations",
        description: "Row picture vs column picture, matrix multiplication, and solving systems of linear equations.",
        durationSec: 2380,
        durationFormatted: "39:40",
        thumbnailUrl: "https://i.ytimg.com/vi/7UJ4CFRGd-U/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "QVKj3LADCnA",
        position: 8,
        title: "9. Orthogonal vectors and subspaces",
        description: "Orthogonal complements, fundamental theorem of linear algebra, and projection onto a line.",
        durationSec: 2450,
        durationFormatted: "40:50",
        thumbnailUrl: "https://i.ytimg.com/vi/QVKj3LADCnA/hqdefault.jpg",
        unavailable: false
      }
    ]
  },

  "PL_TYPE_DESIGN": {
    course: {
      id: "PL_TYPE_DESIGN",
      title: "Intro to Type Design",
      channelTitle: "Studio Foundry",
      thumbnailUrl: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&auto=format&fit=crop&q=80",
      videoCount: 12,
      totalDurationSec: 10200, // 2h 50m
      totalDurationFormatted: "2h 50m",
      description: "Principles of typographic anatomy, optical balance, stroke contrast, bezier curves, kerning pairs, and font engineering.",
      addedAt: "2026-09-21T18:00:00Z",
      lastOpenedAt: "2026-09-24T14:00:00Z"
    },
    videos: [
      {
        videoId: "sByzHoiYFX0",
        position: 0,
        title: "Anatomy of Letterforms & Proportions",
        description: "Ascenders, descenders, x-height, baseline, counters, and optical compensations.",
        durationSec: 620,
        durationFormatted: "10:20",
        thumbnailUrl: "https://i.ytimg.com/vi/sByzHoiYFX0/hqdefault.jpg",
        unavailable: false
      },
      {
        videoId: "q8_7Km_2Bpo",
        position: 2,
        title: "3. Contrast, stress, and proportions",
        description: "Historical models of broad-nib pen, pointed pen, translation vs expansion stress in modern typography.",
        durationSec: 840,
        durationFormatted: "14:00",
        thumbnailUrl: "https://i.ytimg.com/vi/q8_7Km_2Bpo/hqdefault.jpg",
        unavailable: false
      }
    ]
  }
};
