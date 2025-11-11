# Player assignment to groups

The dispatcher algorithm takes a set of participants who have completed the introduction steps of the experiment and assigns them to a group and a treatment, according to specifications from the batch config and the treatment manifest.

When the first player to complete the intro steps enters the lobby, a timer is set for `dispatchWait` seconds, during which time additional players may enter the lobby. When the timer expires, all of the players who are waiting in the lobby are sent to the dispatch algorithm to be assigned to groups.

The dispatch algorithm takes this list of players, along with the list of treatments, treatment payoffs, and knockdowns, and uses a depth-first search to assign players to groups to maximize the total payoff of the dispatch.

It does this first by sorting the available treatments in order of maximum payoff, using a random seed to break ties, and also sorting the list of available players. The algorithm then takes the first player in the queue and assigns them to the first treatment slot that they are eligible for. It then walks through the list of players to fill out this treatment.

The payoffs are apportioned for each player assigned to the treatment, such that assigning three players to a treatment with payoff `1` will yield a total payoff for assigning to that treatment of `3`. This is to ensure that the dispatcher doesn't try to maximize payoff by merely choosing the smallest treatments available, and maximizing the number of groups. This doesn't matter most of the time, but there are times when it makes a difference between selecting fallback conditions, or not

Each time a new treatment is selected, the payoff for that treatment is 'knocked down' by multiplying it by a knockdown factor. This reduces the payoff for the treatment in the next stage of assignment, to distribute assignment across treatments.

The knockdown factor can be specified in three ways.

- as a single number in the range [0,1] that is applied to any treatment when it is used
- as an array of numbers number in the range [0,1] with length corresponding to the number of treatments, with each position in the array used to knock down the payoff for the corresponding treatment
- as a square matrix of numbers in the range [0,1] with each dimension equal to the number of treatments. In this case, when a particular treatment is used, all treatment payoffs can be knocked down by varying amounts. This can be used when treatments sit in a multidimensional treatment space, and instead of distributing assignment across a discrete number of treatments we want to distribute assignment across the space.

After the treatment is filled, the dispatcher moves on to the next player remaining in the queue and continues the process. If a player cannot be assigned to any treatment, they are returned to the lobby.
