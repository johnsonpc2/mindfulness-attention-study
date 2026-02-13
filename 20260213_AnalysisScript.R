# Created: 2026/02/13
# Analysis of data from the Mindfulness and Attention Study, run Spring 2026.
#
# Shortcuts
#   alt + shift + k: shortcut guide
#   alt + o: collapse all sections
#   alt + shift + o: expand all sections
#   ctrl + alt + t: run code section


# Setup -------------------------------------------------------------------

# First we need to install packages from GitHub that we'll need
devtools::install_github(
  repo = "johnsonpc2/pcjtools",
  upgrade = "always",
  force = FALSE
)

devtools::install_github(
  repo = "bcdudek/bcdstats",
  upgrade = "never",
  force = FALSE
)

# And then we can actually load packages we'll use later
pcjtools::load_packages(c("bcdstats", "data.table", "pcjtools", "psych"))

# Not strictly necessary, but I clean the workspace before I do anything
clean_workspace(confirm = FALSE)

# Read In Data ------------------------------------------------------------

# Gather list of all data files in the "data" folder of the project directory
files_info(path = "./data", extension = ".csv") -> data_files

# Import the raw data from the files
import_data(x = data_files$filepath) -> raw_data

# Clean Data --------------------------------------------------------------

local({

  # Filter to just the demographic trials, and keep ID, the phase, and response
  # columns
  raw_data[
    phase %like% "demographics",
    list(sona_id, phase, response)
  ] -> demo_temp

  # Filter out the subjects who took the study multiple times or didn't give
  # their age
  demo_temp[!sona_id %in% c(78958, 79098, 78409, 79251)] -> demo_temp2

  # Widen the responses to wide format so each subject only has one line
  widen_responses(DT = demo_temp2) -> demo_temp3

  # Save a list of subjects to keep and their IDs
  demo_temp3[ , sona_id] -> demo_temp4

  demo_data <- list(
    "demographics" = demo_temp3,
    "subjects to keep" = demo_temp4
  )

}) -> demo_data

raw_data[
  sona_id %in% demo_data$`subjects to keep` &
    phase == "visual_search_trial",
  list(sona_id, phase, rt, response, distractor_type, block, correct,
       target_present)
  ] -> clean_data
