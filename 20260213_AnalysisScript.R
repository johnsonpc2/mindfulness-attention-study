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



